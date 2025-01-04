from flask import Flask, render_template, request, jsonify, send_file
import os
import pandas as pd
import io
import pdfplumber

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

class_data = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_pdf():
    """PDF 파일 업로드 및 데이터 처리"""
    try:
        file = request.files['file']
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)

        global class_data
        class_data = extract_class_data(filepath)
        return jsonify({"message": "PDF processed successfully", "data": class_data})
    except Exception as e:
        print(f"Error during file upload: {e}")
        return jsonify({"message": "Failed to process the PDF"}), 500

@app.route('/update_data', methods=['POST'])
def update_data():
    """클라이언트에서 수정된 데이터를 서버로 업데이트"""
    try:
        global class_data
        class_data = request.json
        return jsonify({"message": "Data updated successfully"}), 200
    except Exception as e:
        print(f"Error during data update: {e}")
        return jsonify({"message": "Failed to update data"}), 500

@app.route('/download', methods=['GET'])
def download_excel():
    """현재 class_data를 엑셀로 다운로드"""
    try:
        if not class_data:
            raise ValueError("class_data is empty. Please upload a PDF first.")

        # DataFrame 생성
        all_data = []
        for cls, students in class_data.items():
            for student in students:
                previous = student.get("이전학적", "").split()
                previous_grade = previous[0] if len(previous) > 0 else ""
                previous_class = previous[1] if len(previous) > 1 else ""
                previous_number = previous[2] if len(previous) > 2 else ""

                student_row = {
                    "반": cls,
                    "번호": student.get("번호", ""),
                    "성명": student.get("성명", ""),
                    "생년월일": student.get("생년월일", ""),
                    "성별": student.get("성별", ""),
                    "기준성적": student.get("기준성적", ""),
                    "이전학적 학년": previous_grade,
                    "이전학적 반": previous_class,
                    "이전학적 번호": previous_number,
                }
                all_data.append(student_row)

        df = pd.DataFrame(all_data)

        # 메모리 내 엑셀 파일 생성
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="반배정 결과")
        buffer.seek(0)

        return send_file(
            buffer,
            as_attachment=True,
            download_name="반배정_결과.xlsx",
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        print(f"Error during file download: {e}")
        return jsonify({"message": "Failed to generate the Excel file"}), 500

def extract_class_data(filepath):
    """PDF 파일에서 반배정 데이터를 추출"""
    try:
        classes = {}
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                lines = text.split("\n")

                for line in lines:
                    tokens = line.split()
                    if len(tokens) >= 8 and tokens[0].isdigit():
                        grade, cls, num, name, dob, gender, score, *previous = tokens
                        class_key = f"{grade}-{cls}"
                        if class_key not in classes:
                            classes[class_key] = []
                        classes[class_key].append({
                            "번호": num,
                            "성명": name,
                            "생년월일": dob,
                            "성별": gender,
                            "기준성적": score,
                            "이전학적": " ".join(previous)
                        })
        return classes
    except Exception as e:
        print(f"Error during PDF extraction: {e}")
        return {}

if __name__ == '__main__':
    app.run(debug=True)
