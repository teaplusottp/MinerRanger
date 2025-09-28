import inspect
from google.adk.agents import LlmAgent
print(inspect.getsource(LlmAgent._run_async_impl))
