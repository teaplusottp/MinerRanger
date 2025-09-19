import json

def generate_html():
    # Đọc report.json
    with open("report.json", "r", encoding="utf-8") as f:
        report = json.load(f)

    title = report["report_title"].replace("_", " ")
    description = report["description"]
    start_time = report["dataset_overview"]["date_range"]["start_time"]
    end_time = report["dataset_overview"]["date_range"]["end_time"]

    # Tạo nội dung HTML
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>{title}</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                padding: 20px;
                line-height: 1.6;
            }}
            h1 {{
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 15px;
            }}
            pre {{
                white-space: pre-wrap;
                font-size: 14px;
            }}
            .date-range {{
                margin-top: 20px;
                font-size: 14px;
            }}
        </style>
    </head>
    <body>
        <h1>{title}</h1>
        <pre>{description}</pre>
        <div class="date-range">
            <p><b>Start time:</b> {start_time}</p>
            <p><b>End time:</b> {end_time}</p>
        </div>
    </body>
    </html>
    """

    # Ghi ra file
    with open("graph.html", "w", encoding="utf-8") as f:
        f.write(html_content)

if __name__ == "__main__":
    generate_html()
