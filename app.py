from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_file
import os
import pandas as pd
import io
import pdfplumber
import openpyxl
import json
import re

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



'''신규 추가'''
@app.route('/load_data', methods=['GET'])
def load_data():
    """저장된 데이터를 불러옴"""
    try:
        current_class = session.get('name')
        if not current_class:
            return jsonify({"message": "로그인이 필요합니다."}), 403

        # JSON 파일이 없으면 초기화
        json_path = os.path.join(UPLOAD_FOLDER, 'class_data.json')
        if not os.path.exists(json_path):
            return jsonify({"success": True, "data": {}})  # 빈 데이터 반환

        # JSON 파일 읽기
        with open(json_path, 'r') as f:
            global class_data
            class_data = json.load(f)

        # 현재 학년 데이터 반환
        if current_class in class_data:
            return jsonify({"success": True, "data": class_data[current_class]})
        else:
            return jsonify({"success": True, "data": {}})  # 해당 학년 데이터 없음
    except Exception as e:
        print(f"데이터 로드 중 오류 발생: {e}")
        return jsonify({"success": False, "message": "데이터 로드 실패"}), 500


@app.route('/reset_class_data', methods=['POST'])
def reset_class_data():
    """현재 로그인한 학년 데이터 초기화"""
    try:
        current_class = session.get('name')
        if not current_class:
            return jsonify({"success": False, "message": "로그인이 필요합니다."}), 403

        global class_data
        # 현재 학년에 대한 데이터 초기화
        if current_class in class_data:
            del class_data[current_class]  # 해당 학년 데이터 삭제
            save_class_data()  # JSON 파일에 저장

        return jsonify({"success": True, "message": f"{current_class} 데이터가 초기화되었습니다."})
    except Exception as e:
        print(f"데이터 초기화 중 오류 발생: {e}")
        return jsonify({"success": False, "message": "데이터 초기화 실패"}), 500





@app.route('/upload', methods=['POST'])
def upload_pdf():
    """PDF 파일 업로드 및 데이터 처리"""
    try:
        file = request.files['file']
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)

        current_class = session.get('name')
        if not current_class:
            return jsonify({"message": "로그인이 필요합니다."}), 403

        # PDF 데이터 처리
        global class_data
        class_data.setdefault(current_class, {})  # 현재 학년에 빈 데이터 초기화
        class_data[current_class] = extract_class_data(filepath)

        # 데이터 저장
        save_class_data()

        return jsonify({"message": "PDF 처리 및 저장 완료", "data": class_data[current_class]})
    except Exception as e:
        print(f"파일 업로드 중 오류 발생: {e}")
        return jsonify({"message": "PDF 처리 실패"}), 500


def save_class_data():
    """학년 데이터를 JSON 파일로 저장"""
    with open(os.path.join(UPLOAD_FOLDER, 'class_data.json'), 'w') as f:
        json.dump(class_data, f)



@app.route('/update_data', methods=['POST'])
def update_data():
    """클라이언트에서 수정된 데이터를 서버로 업데이트"""
    try:
        current_class = session.get('name')
        if not current_class:
            return jsonify({"message": "로그인이 필요합니다."}), 403

        # 데이터 업데이트
        global class_data
        class_data[current_class] = request.json

        # 데이터 저장
        save_class_data()

        return jsonify({"message": "데이터 저장 완료"}), 200
    except Exception as e:
        print(f"데이터 업데이트 중 오류 발생: {e}")
        return jsonify({"message": "데이터 저장 실패"}), 500




@app.route('/download', methods=['GET'])
def download_excel():
    print("DEBUG: class_data =", class_data)

    """현재 세션에 해당하는 학년 데이터를 엑셀로 다운로드"""
    try:
        # 세션에서 현재 학년 가져오기
        current_class = session.get('name')
        if not current_class:
            raise ValueError("로그인이 필요합니다. 해당 세션에 학년 정보가 없습니다.")

        # 현재 학년에 해당하는 데이터 확인
        if current_class not in class_data:
            raise ValueError(f"{current_class} 데이터가 존재하지 않습니다.")

        # 현재 학년 데이터만 처리
        all_data = []
        class_data_filtered = class_data[current_class]

        def process_class_data(class_data):
            """재귀적으로 class_data를 처리하여 플랫 데이터 수집"""
            for cls, students in class_data.items():
                if isinstance(students, list):  # 학생 리스트인 경우
                    for student in students:
                        previous = student.get("이전학적", "").split()
                        previous_grade = int(previous[0]) if len(previous) > 0 and previous[0].isdigit() else None
                        previous_class = int(previous[1]) if len(previous) > 1 and previous[1].isdigit() else None
                        previous_number = int(previous[2]) if len(previous) > 2 and previous[2].isdigit() else None

                        # '반'과 '학년' 분리
                        grade, class_number = cls.split("-") if "-" in cls else (cls, None)

                        student_row = {
                            "학년": int(grade) if grade.isdigit() else grade,
                            "반": int(class_number) if class_number and class_number.isdigit() else "",
                            "번호": int(student.get("번호", 0)),
                            "성명": student.get("성명", ""),
                            "생년월일": student.get("생년월일", ""),
                            "성별": student.get("성별", ""),
                            "기준성적": float(student.get("기준성적", 0)),
                            "이전학적 학년": previous_grade,
                            "이전학적 반": previous_class,
                            "이전학적 번호": previous_number,
                        }
                        all_data.append(student_row)

        # 필터링된 데이터 처리
        process_class_data(class_data_filtered)

        if not all_data:
            raise ValueError("No valid data to export to Excel.")

        # DataFrame으로 엑셀 파일 생성
        df = pd.DataFrame(all_data)
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=f"{current_class} 반배정 결과")
            workbook = writer.book
            worksheet = writer.sheets[f"{current_class} 반배정 결과"]

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
                col_idx = df.columns.get_loc(column) + 1
                worksheet.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

            # 정렬 스타일
            center_alignment = openpyxl.styles.Alignment(horizontal="center", vertical="center")
            for row in worksheet.iter_rows(min_row=2, max_row=len(df) + 1):
                for cell in row:
                    if cell.column != df.columns.get_loc("기준성적") + 1:
                        cell.alignment = center_alignment

        buffer.seek(0)  # 파일 포인터 초기화

        # 엑셀 파일 전송
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"{current_class}_반배정_결과.xlsx",
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except ValueError as ve:
        print(f"Validation Error: {ve}")
        return jsonify({"message": str(ve)}), 400
    except Exception as e:
        print(f"Error during file download: {e}")
        return jsonify({"message": "Failed to generate the Excel file"}), 500







def extract_class_data(filepath):
    """PDF 파일에서 반배정 데이터를 추출"""
    try:
        classes = {}

        def extract_number(value):
            """문자열에서 숫자만 추출"""
            match = re.search(r'\d+', value)
            return match.group() if match else ""

        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                lines = text.split("\n")

                for line in lines:
                    tokens = line.split()
                    if len(tokens) >= 8:
                        # 학년에서 숫자만 추출
                        grade = extract_number(tokens[0])
                        # 반
                        cls = tokens[1]
                        # 번호, 성명, 생년월일, 성별, 기준성적
                        num, name, dob, gender, score = tokens[2:7]
                        # 이전학적 정보 처리
                        previous = tokens[7:]
                        previous_grade = extract_number(previous[0]) if len(previous) > 0 else ""
                        previous_class = previous[1] if len(previous) > 1 else ""
                        previous_number = previous[2] if len(previous) > 2 else ""

                        class_key = f"{grade}-{cls}"
                        if class_key not in classes:
                            classes[class_key] = []
                        classes[class_key].append({
                            "번호": num,
                            "성명": name,
                            "생년월일": dob,
                            "성별": gender,
                            "기준성적": score,
                            "이전학적": " ".join(previous),
                            "이전학적 학년": previous_grade,
                            "이전학적 반": previous_class,
                            "이전학적 번호": previous_number,
                        })
        return classes
    except Exception as e:
        print(f"Error during PDF extraction: {e}")
        return {}





if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))  # 환경 변수 PORT를 가져오고, 기본값으로 5000 사용
    app.run(host="0.0.0.0", port=port, debug=True)  # 모든 IP에서 접속 가능하도록 host="0.0.0.0" 설정