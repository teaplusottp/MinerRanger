from google.adk.runtime import invocation_context
import inspect
print(invocation_context)
print([name for name in dir(invocation_context) if not name.startswith('_')])
