import os
import re
import tempfile
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader
from dotenv import load_dotenv
from openai import OpenAI
import json


load_dotenv(dotenv_path=".env.local")

app = Flask(
    __name__,
    template_folder="../backend/templates",
    static_folder="../backend/static"
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'txt', 'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def read_file(file_path, extension):
    if extension == "txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif extension == "pdf":
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    return ""


def clean_email_text(text: str) -> str:
    """Remove sintaxe markdown [email](mailto:email) e deixa só o endereço"""
    return re.sub(r"\[.*?\]\(mailto:(.*?)\)", r"\1", text)
    


def split_emails(text):
    if "From" not in text:
        return [text.strip()]
    blocks = text.split("\nFrom")
    return [("From" + b if not b.startswith("From") else b).strip() for b in blocks if b.strip()]



def classify_and_generate(email_text):
    """Classifica, extrai detalhes e gera resposta via OpenAI"""
    prompt = f"""
Você é um classificador de emails da AutoU.

Tarefas:
1. Classifique o email como "Produtivo" ou "Improdutivo".
2. Extraia até 5 palavras-chave mais importantes.
3. Extraia os detalhes do email: remetente, assunto, data.
4. Gere uma resposta automática adequada.

Regras:
- Retorne apenas JSON válido. Não adicione comentários ou texto fora do JSON.
- Caso não haja cabeçalho, considere todo o conteúdo como corpo do email.
- Se algum campo não tiver informação, retorne vazio (""), mas mantenha a chave no JSON.
- O campo "email_body" deve conter apenas o texto puro do email, sem cabeçalhos ou metadados ou tags HTML.
- Retorne SOMENTE o JSON válido, nada além disso.
- retorne a Data no formato "Mon, 2 Sep 2025 10:15:00"


Responda em JSON no formato:
{{
    "classification": "",
    "keywords": [],
    "sender": "",
    "subject": "",
    "date": "",
    "email_body": "",
    "reply": ""
}}

Email:
{email_text}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Você é um classificador de emails."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.4,
        max_tokens=800
    )

    raw_text = response.choices[0].message.content

    try:
        parsed = json.loads(raw_text)
    except Exception:
        parsed = {
            "classification": "—-",
            "keywords": [],
            "sender": "Sem remetente",
            "subject": "Sem assunto",
            "date": "--",
            "email_body": email_text,
            "reply": raw_text
        }

    return {"raw": raw_text, **parsed}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/process", methods=["POST"])
def process():
    email_text = ""

    if "file" in request.files and request.files["file"].filename != "":
        file = request.files["file"]
        if allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(file_path)
            ext = filename.rsplit(".", 1)[1].lower()
            email_text = read_file(file_path, ext)
            os.remove(file_path)

    elif "text" in request.form and request.form["text"].strip() != "":
        email_text = request.form["text"]

    if not email_text:
        return jsonify({"error": "Nenhum conteúdo válido encontrado."}), 400

    # Limpeza aqui antes de processar
    email_text = clean_email_text(email_text)

    emails = split_emails(email_text)
    results = []

    for e in emails:
        result = classify_and_generate(e)
        results.append(result)

    return jsonify(results)


# if __name__ == "__main__":
#     app.run(debug=True)
