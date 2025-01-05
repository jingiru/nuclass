from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os
import pandas as pd
import io
import pdfplumber
import openpyxl

app = Flask(__name__)
app.secret_key = 'your_secret_key'

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

class_data = {}

@app.route('/')
def login_page():
    """로그인 페이지 렌더링"""
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    """로그인 처리"""
    try:
        data = request.json
        name = data.get("name").strip()

        # 유효한 이름 검증
        valid_names = ["2학년", "3학년"]
        if name not in valid_names:
            return jsonify({"success": False, "message": "유효한 학년을 입력해주세요. (예: 2학년, 3학년)"}), 400

        # 세션에 저장
        session['name'] = name
        print(f"세션에 저장된 이름: {session['name']}")  # 디버깅용 로그
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"로그인 중 오류 발생: {e}")
        return jsonify({"success": False, "message": "로그인 처리 중 오류가 발생했습니다."}), 500


@app.route('/dashboard')
def dashboard():
    """반 배정 프로그램 페이지"""
    if 'name' not in session:
        return redirect(url_for('login_page'))  # 로그인하지 않은 경우 로그인 페이지로 리다이렉트
    return render_template('index.html')  # 기존 index.html





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
                previous_grade = int(previous[0]) if len(previous) > 0 and previous[0].isdigit() else None
                previous_class = int(previous[1]) if len(previous) > 1 and previous[1].isdigit() else None
                previous_number = int(previous[2]) if len(previous) > 2 and previous[2].isdigit() else None

                # '반'과 '학년' 분리
                grade, class_number = cls.split("-")

                student_row = {
                    "학년": int(grade),  # 학년 추가
                    "반": int(class_number),  # 반 데이터만 추출
                    "번호": int(student.get("번호", 0)),  # 숫자 변환
                    "성명": student.get("성명", ""),
                    "생년월일": student.get("생년월일", ""),
                    "성별": student.get("성별", ""),
                    "기준성적": float(student.get("기준성적", 0)),  # 숫자 변환
                    "이전학적 학년": previous_grade,  # 숫자 변환
                    "이전학적 반": previous_class,  # 숫자 변환
                    "이전학적 번호": previous_number,  # 숫자 변환
                }
                all_data.append(student_row)

        df = pd.DataFrame(all_data)

        # 메모리 내 엑셀 파일 생성
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            # DataFrame 작성
            df.to_excel(writer, index=False, sheet_name="반배정 결과")

            # 스타일 및 열 크기 조정
            workbook = writer.book
            worksheet = writer.sheets["반배정 결과"]

            # 열 너비 조정
            column_widths = {
                "학년": 8,
                "반": 8,
                "번호": 8,
                "성명": 15,
                "생년월일": 12,
                "성별": 8,
                "기준성적": 10,
                "이전학적 학년": 15,
                "이전학적 반": 15,
                "이전학적 번호": 15,
            }
            for column, width in column_widths.items():
                col_idx = df.columns.get_loc(column) + 1  # 1-based index
                worksheet.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

            # 가운데 정렬 스타일
            center_alignment = openpyxl.styles.Alignment(horizontal="center", vertical="center")
            for row_idx, row in enumerate(worksheet.iter_rows(min_row=2, max_row=len(df) + 1), start=2):
                for cell in row:
                    if cell.column != df.columns.get_loc("기준성적") + 1:  # 기준성적 제외
                        cell.alignment = center_alignment

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
