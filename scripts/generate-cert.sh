#!/usr/bin/env sh
# generate-cert.sh — Generate a self-signed TLS certificate for local deployment.
#
# Produces a 10-year self-signed certificate with configurable Subject
# Alternative Names (SANs). The public certificate (condor.crt) is committed
# to the repository; the private key (condor.key) is gitignored.
#
# Outputs:
#   - frontend/ssl/condor.crt  : Public certificate (committed to repo)
#   - frontend/ssl/condor.key  : Private key (gitignored)
#
# Usage:
#   scripts/generate-cert.sh 192.168.1.50          # IP-based SAN
#   scripts/generate-cert.sh condor.local           # Hostname SAN
#   scripts/generate-cert.sh 192.168.1.50 condor.local  # Multiple SANs
#   scripts/generate-cert.sh --force                # Regenerate existing cert
#   scripts/generate-cert.sh --force 192.168.1.50   # Regenerate with SANs

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SSL_DIR="${PROJECT_ROOT}/frontend/ssl"
CERT_FILE="${SSL_DIR}/condor.crt"
KEY_FILE="${SSL_DIR}/condor.key"

# ── Argument parsing ─────────────────────────────────────────────────────────

FORCE=false
SANS=""

for arg in "$@"; do
    case "$arg" in
        --force) FORCE=true ;;
        *)
            if [ -z "$SANS" ]; then
                SANS="$arg"
            else
                SANS="${SANS},${arg}"
            fi
            ;;
    esac
done

# ── Idempotency check ────────────────────────────────────────────────────────

if [ "$FORCE" = false ] && [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "Certificate already exists at ${CERT_FILE}"
    echo "  Use --force to regenerate."
    exit 0
fi

# ── Validate SANs ────────────────────────────────────────────────────────────

if [ -z "$SANS" ]; then
    echo "Error: At least one Subject Alternative Name is required."
    echo ""
    echo "Usage:"
    echo "  scripts/generate-cert.sh 192.168.1.50          # IP address"
    echo "  scripts/generate-cert.sh condor.local           # Hostname"
    echo "  scripts/generate-cert.sh 192.168.1.50 condor.local  # Multiple"
    exit 1
fi

# ── Build SAN configuration ──────────────────────────────────────────────────

# Classify each SAN as IP or DNS for the openssl config
SAN_ENTRIES=""
IFS=',' read -ra SAN_ARRAY <<< "$SANS"
for san in "${SAN_ARRAY[@]}"; do
    # Check if it looks like an IP address (contains only digits and dots or colons)
    if echo "$san" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
        SAN_ENTRIES="${SAN_ENTRIES}IP:${san},"
    elif echo "$san" | grep -qE '^[0-9a-fA-F:]+$'; then
        # IPv6 address
        SAN_ENTRIES="${SAN_ENTRIES}IP:${san},"
    else
        SAN_ENTRIES="${SAN_ENTRIES}DNS:${san},"
    fi
done

# Remove trailing comma
SAN_ENTRIES="${SAN_ENTRIES%,}"

echo "Generating self-signed certificate..."
echo "  SANs: ${SAN_ENTRIES}"
echo "  Validity: 10 years (3650 days)"

# ── Create SSL directory ─────────────────────────────────────────────────────

mkdir -p "$SSL_DIR"

# ── Generate certificate with openssl ────────────────────────────────────────

# Create a temporary openssl config with SAN extension
OPENSSL_CONF=$(mktemp)
trap 'rm -f "$OPENSSL_CONF"' EXIT

cat > "$OPENSSL_CONF" << EOF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = v3_req
x509_extensions    = v3_req

[dn]
CN                 = condor-local
O                  = Condor
C                  = US

[v3_req]
subjectAltName     = ${SAN_ENTRIES}
basicConstraints   = CA:FALSE
keyUsage           = digitalSignature, keyEncipherment
extendedKeyUsage   = serverAuth
EOF

openssl req -x509 -nodes -days 3650 \
    -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -config "$OPENSSL_CONF"

echo ""
echo "Certificate generated successfully:"
echo "  Public cert: ${CERT_FILE}  (committed to repo)"
echo "  Private key: ${KEY_FILE}  (gitignored)"
echo ""
echo "Next steps:"
echo "  1. Commit the public cert: git add ${CERT_FILE}"
echo "  2. Build and deploy the Docker image"
echo "  3. Distribute ${CERT_FILE} to client machines and add to their trust store"
echo "     See README.md for platform-specific instructions."
