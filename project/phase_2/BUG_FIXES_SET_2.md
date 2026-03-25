# Scope of changes

- Address bugs listed below
- Update and add tests as appropriate
- Ensure all (not just new/updated) tests pass
- Make sure README user instructions are up to date

# References

Please refer to the following documents for more details on design and implementation:
- ./README.md
- ./docs/SYSTEM_ARCHITECTURE.md
- ./docs/FRONTEND_DESIGN.md
- ./docs/BACKEND_DESIGN.md

Frontend code and tests are in ./frontend. Backend code and tests are in ./backend. Playwright integration tests are in ./frontend/tests.

# Bug list

- Text size in the angle and text annotations is way too small, refer to the linewidths that we use in the rendered annotations to assess what is a reasonable text size
- Angle annotation drawing is off - first click creates vertex 1, drag a line to vertex 2 and click, that starts drawing a line to vertex 3, however vertex 3 connects to vertex 1, which is very non-intuitive; we should have vertex 3 connect to vertex 2 so that we measure the angle 1-2-3 rather than 2-1-3
- Check on keyboard shortcut - delete should delete selected annotation(s), not working on mac at least
- When a new video is loaded, clear the sync and trim state and go back to sync mode
- Relatedly, there is an issue with the scrub bar where one of the trim handles goes outside the bar and even off screen, and the green playback range edge does not match the trim in/out handles
- Loading a saved session doesn't fully restore state - it starts in Sync mode rather than Playback mode, and the videos are not synchronized. Also, though the videos load from the library properly, we still see the "No video uploaded" banner underneath the choose file button for each channel. Additionally, the save video buttons for both channels are enabled despite both already being saved to the library.
- If I upload a video to a channel and save to library, and then upload a new video on the same channel, the save to library button is still disabled and it says "Video A saved"
- If I load a video directly from the library (e.g. not from loading a saved session), the save video button is enabled; it should be disabled in this scenario
- If I load a video directly from the library (e.g. not from loading a saved session), I still see the "No video uploaded" banner underneath the choose file button
- I was able to save one session, but in trying to save a second session I got an HTTP 500 error again; output from the backend service is below

# Backend output on failed session save

INFO:     127.0.0.1:39542 - "POST /api/sessions HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
Traceback (most recent call last):
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 550, in _prepare_and_execute
    self._rows = deque(await prepared_stmt.fetch(*parameters))
                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/asyncpg/prepared_stmt.py", line 177, in fetch
    data = await self.__bind_execute(args, 0, timeout)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/asyncpg/prepared_stmt.py", line 268, in __bind_execute
    data, status, _ = await self.__do_execute(
                      ^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/asyncpg/prepared_stmt.py", line 257, in __do_execute
    return await executor(protocol)
           ^^^^^^^^^^^^^^^^^^^^^^^^
  File "asyncpg/protocol/protocol.pyx", line 205, in bind_execute
asyncpg.exceptions.ForeignKeyViolationError: insert or update on table "analysis_sessions" violates foreign key constraint "analysis_sessions_video_a_id_fkey"
DETAIL:  Key (video_a_id)=(22cb186e-6b47-49c9-9fd0-0acf8bf915dc) is not present in table "library_videos".

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/base.py", line 1967, in _exec_single_context
    self.dialect.do_execute(
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 585, in execute
    self._adapt_connection.await_(
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 132, in await_only
    return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 196, in greenlet_spawn
    value = await result
            ^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 563, in _prepare_and_execute
    self._handle_exception(error)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 513, in _handle_exception
    self._adapt_connection._handle_exception(error)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 797, in _handle_exception
    raise translated_error from error
sqlalchemy.dialects.postgresql.asyncpg.AsyncAdapt_asyncpg_dbapi.IntegrityError: <class 'asyncpg.exceptions.ForeignKeyViolationError'>: insert or update on table "analysis_sessions" violates foreign key constraint "analysis_sessions_video_a_id_fkey"
DETAIL:  Key (video_a_id)=(22cb186e-6b47-49c9-9fd0-0acf8bf915dc) is not present in table "library_videos".

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/code/.venv/lib/python3.11/site-packages/uvicorn/protocols/http/httptools_impl.py", line 419, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/uvicorn/middleware/proxy_headers.py", line 84, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/fastapi/applications.py", line 1054, in __call__
    await super().__call__(scope, receive, send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/applications.py", line 123, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/middleware/errors.py", line 186, in __call__
    raise exc
  File "/code/.venv/lib/python3.11/site-packages/starlette/middleware/errors.py", line 164, in __call__
    await self.app(scope, receive, _send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/middleware/cors.py", line 91, in __call__
    await self.simple_response(scope, receive, send, request_headers=headers)
  File "/code/.venv/lib/python3.11/site-packages/starlette/middleware/cors.py", line 146, in simple_response
    await self.app(scope, receive, send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/middleware/exceptions.py", line 62, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/_exception_handler.py", line 64, in wrapped_app
    raise exc
  File "/code/.venv/lib/python3.11/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
    await app(scope, receive, sender)
  File "/code/.venv/lib/python3.11/site-packages/starlette/routing.py", line 762, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/routing.py", line 782, in app
    await route.handle(scope, receive, send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/routing.py", line 297, in handle
    await self.app(scope, receive, send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/routing.py", line 77, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "/code/.venv/lib/python3.11/site-packages/starlette/_exception_handler.py", line 64, in wrapped_app
    raise exc
  File "/code/.venv/lib/python3.11/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
    await app(scope, receive, sender)
  File "/code/.venv/lib/python3.11/site-packages/starlette/routing.py", line 72, in app
    response = await func(request)
               ^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/fastapi/routing.py", line 299, in app
    raise e
  File "/code/.venv/lib/python3.11/site-packages/fastapi/routing.py", line 294, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/fastapi/routing.py", line 191, in run_endpoint_function
    return await dependant.call(**values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/backend/routes/sessions.py", line 65, in create_session
    session = await session_repository.create_session(db, current_user.id, payload)
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/backend/repositories/session_repository.py", line 58, in create_session
    await db.commit()
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/ext/asyncio/session.py", line 1000, in commit
    await greenlet_spawn(self.sync_session.commit)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 203, in greenlet_spawn
    result = context.switch(value)
             ^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/session.py", line 2030, in commit
    trans.commit(_to_root=True)
  File "<string>", line 2, in commit
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/state_changes.py", line 137, in _go
    ret_value = fn(self, *arg, **kw)
                ^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/session.py", line 1311, in commit
    self._prepare_impl()
  File "<string>", line 2, in _prepare_impl
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/state_changes.py", line 137, in _go
    ret_value = fn(self, *arg, **kw)
                ^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/session.py", line 1286, in _prepare_impl
    self.session.flush()
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/session.py", line 4331, in flush
    self._flush(objects)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/session.py", line 4466, in _flush
    with util.safe_reraise():
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/util/langhelpers.py", line 121, in __exit__
    raise exc_value.with_traceback(exc_tb)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/session.py", line 4427, in _flush
    flush_context.execute()
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/unitofwork.py", line 466, in execute
    rec.execute(self)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/unitofwork.py", line 642, in execute
    util.preloaded.orm_persistence.save_obj(
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/persistence.py", line 93, in save_obj
    _emit_insert_statements(
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/orm/persistence.py", line 1233, in _emit_insert_statements
    result = connection.execute(
             ^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/base.py", line 1419, in execute
    return meth(
           ^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/sql/elements.py", line 527, in _execute_on_connection
    return connection._execute_clauseelement(
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/base.py", line 1641, in _execute_clauseelement
    ret = self._execute_context(
          ^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/base.py", line 1846, in _execute_context
    return self._exec_single_context(
           ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/base.py", line 1986, in _exec_single_context
    self._handle_dbapi_exception(
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/base.py", line 2363, in _handle_dbapi_exception
    raise sqlalchemy_exception.with_traceback(exc_info[2]) from e
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/base.py", line 1967, in _exec_single_context
    self.dialect.do_execute(
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/engine/default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 585, in execute
    self._adapt_connection.await_(
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 132, in await_only
    return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 196, in greenlet_spawn
    value = await result
            ^^^^^^^^^^^^
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 563, in _prepare_and_execute
    self._handle_exception(error)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 513, in _handle_exception
    self._adapt_connection._handle_exception(error)
  File "/code/.venv/lib/python3.11/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 797, in _handle_exception
    raise translated_error from error
sqlalchemy.exc.IntegrityError: (sqlalchemy.dialects.postgresql.asyncpg.IntegrityError) <class 'asyncpg.exceptions.ForeignKeyViolationError'>: insert or update on table "analysis_sessions" violates foreign key constraint "analysis_sessions_video_a_id_fkey"
DETAIL:  Key (video_a_id)=(22cb186e-6b47-49c9-9fd0-0acf8bf915dc) is not present in table "library_videos".
[SQL: INSERT INTO analysis_sessions (id, user_id, name, notes, video_a_id, video_b_id, sync_frame_a, sync_frame_b, trim_start_a, trim_end_a, trim_start_b, trim_end_b, playback_speed, loop_playback, annotations) VALUES ($1::UUID, $2::UUID, $3::VARCHAR, $4::VARCHAR, $5::UUID, $6::UUID, $7::INTEGER, $8::INTEGER, $9::INTEGER, $10::INTEGER, $11::INTEGER, $12::INTEGER, $13::FLOAT, $14::BOOLEAN, $15::JSONB) RETURNING analysis_sessions.created_at, analysis_sessions.updated_at]
[parameters: (UUID('7d907c7f-461d-478b-a905-24645748f5eb'), UUID('00000000-0000-0000-0000-000000000001'), '2025-11-16 6i', 'Good form - immediately prior to FL trip for first time breaking 80', UUID('22cb186e-6b47-49c9-9fd0-0acf8bf915dc'), UUID('12a35146-2114-46a3-b2d8-16ba10790b42'), None, None, 312, 387, None, None, 1.0, False, '{"a": [{"id": "annotation-1", "type": "polyline", "points": [{"x": 546, "y": 813.28125}, {"x": 393, "y": 1008.28125}, {"x": 471, "y": 1230.28125}, {" ... (741 characters truncated) ... otation-3", "type": "oval", "points": [{"x": 486.890625, "y": 675.28125}, {"x": 552.890625, "y": 813.28125}], "color": "#FF0000", "strokeWidth": 6}]}')]
(Background on this error at: https://sqlalche.me/e/20/gkpj)