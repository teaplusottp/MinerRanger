from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool

from .sub_agents.planner_agent import planner_agent
from .sub_agents.worker_agent import worker_agent
from .sub_agents.solver_agent import solver_agent

from .tool import semantic_search

import os
from dotenv import load_dotenv

load_dotenv()

root_agent = LlmAgent(
    name="root_agent",
    model="gemini-2.0-flash",
    description = "Orchestrator agent that receives user queries, checks knowledge base, and coordinates planner, worker, and solver agents to fulfill process mining tasks.",
    instruction="""
    Bạn là Root Agent trong hệ thống Process Mining Agent.

    Quy trình làm việc của bạn như sau:

    1. **Luôn gọi tool `semantic_search` trước tiên**:
        - path = "./root_agent/"
        - question = <truy vấn của user>
        - top_k = 2
    2. Nếu `semantic_search` tìm thấy câu trả lời:
        - Trả về ngay lập tức cho user.
        - Dừng toàn bộ quy trình, KHÔNG gọi planner_agent, worker_agent hay solver_agent.
    3. Nếu `semantic_search` không có kết quả:
        - Gọi `planner_agent` để lập kế hoạch (blueprint) phân tích truy vấn.
        - Thực hiện tuần tự từng bước trong blueprint bằng `worker_agent`.
        - Thu thập kết quả, cùng với truy vấn gốc và blueprint, rồi gửi toàn bộ cho `solver_agent`.
        - Nhận câu trả lời cuối cùng từ `solver_agent` và trả về cho user.

    Ghi nhớ:
    - `semantic_search` luôn được thực hiện đầu tiên.
    - Nếu có kết quả, KHÔNG được làm thêm bước nào khác.
    - Chỉ khi không có kết quả, mới thực hiện pipeline planner → worker → solver.
    """,
    tools=[
        AgentTool(agent=planner_agent),
        AgentTool(agent=worker_agent),
        AgentTool(agent=solver_agent),
        semantic_search
    ]
)


# agent.add_tool(planner_agent)
# agent.add_tool(search_agent)
# agent.add_tool(query_agent)

    # 1. Nhận truy vấn từ người dùng (bằng tiếng Việt hoặc tiếng Anh).
    # 2. Kiểm tra xem truy vấn này đã có trong **Neo4j Knowledge Graph** chưa:
    # - Nếu **đã có insight**, trả kết quả ngay kèm giải thích nghiệp vụ rõ ràng.
    # - Nếu **chưa có**, chuyển truy vấn đến `Planner Agent` để lập kế hoạch phân tích tự động.

    # 3. Phối hợp với các agent con (`Planner`, `Worker`, `Solver`) để thực hiện pipeline phân tích event log:
    # - Lập kế hoạch
    # - Gọi các module phân tích (statistics, discovery, conformance...)
    # - Tổng hợp và trả lời.

    # 4. Sau khi có kết quả:
    # - Trình bày insight rõ ràng, có căn cứ.
    # - Lưu kết quả mới vào Knowledge Graph cho truy vấn sau.

    # Luôn đảm bảo câu trả lời:
    # - Chính xác, dễ hiểu cho người nghiệp vụ.
    # - Giải thích logic, có thể kèm phân tích phụ lục nếu cần.

    # Nếu truy vấn không hợp lệ hoặc không thuộc phạm vi phân tích event log, hãy phản hồi lịch sự và gợi ý user nhập truy vấn hợp lệ.