import http.server
import socketserver
import json
import os
import urllib.parse

PORT = 8080
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def guess_type(self, path):
        if path.lower().endswith('.pdf'):
            return 'application/pdf'
        return super().guess_type(path)

    def end_headers(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path.lower().endswith('.pdf'):
            self.send_header('Content-Disposition', 'inline')
            self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == "/api/pdfs":
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            pdfs = [f for f in os.listdir(DIRECTORY) if f.endswith(".pdf") and os.path.isfile(f)]
            # Prioritize the two specific PDFs
            prioritize = ["26年考前冲刺资料-可认真看.pdf", "默写本及参考答案.pdf"]
            pdfs.sort(key=lambda x: (0 if x in prioritize else 1, x))
            self.wfile.write(json.dumps(pdfs).encode("utf-8"))
        elif parsed_path.path == "/":
            self.send_response(301)
            self.send_header("Location", "/web/index.html")
            self.end_headers()
        else:
            super().do_GET()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at port {PORT}")
    print("Open http://localhost:8080 to access the reading system.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
