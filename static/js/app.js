let classData = {};
let selectedStudents = [];
let history = [];
let changedStudents = new Set();

document.getElementById("pdfUpload").addEventListener("change", async (event) => {
    const file = event.target.files[0];

    if (!file) {
        console.error("파일이 선택되지 않았습니다.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error("파일 업로드 실패");
        }

        const result = await response.json();

        if (result.message !== "PDF processed successfully") {
            throw new Error(`서버에서 처리 실패: ${result.message}`);
        }

        classData = result.data;
        renderClasses();
    } catch (error) {
        console.error(`파일 업로드 중 오류가 발생했습니다: ${error.message}`);
    }
});

document.getElementById("downloadExcelButton").addEventListener("click", () => {
    window.location.href = "/download";
});

async function updateServerData() {
    try {
        const response = await fetch("/update_data", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(classData)
        });

        if (!response.ok) {
            throw new Error("서버 데이터 업데이트 실패");
        }

        console.log("서버 데이터가 성공적으로 업데이트되었습니다.");
    } catch (error) {
        console.error(`서버 데이터 업데이트 중 오류 발생: ${error.message}`);
    }
}

function renderClasses() {
    const container = document.getElementById("classesContainer");
    container.innerHTML = "";

    Object.keys(classData).forEach((cls) => {
        const classBox = document.createElement("div");
        classBox.className = "class-box";
        classBox.innerHTML = `<h3>${cls}반</h3>`;

        const table = document.createElement("table");
        table.className = "student-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th rowspan="2">번호</th>
                    <th rowspan="2">성명</th>
                    <th rowspan="2">생년월일</th>
                    <th rowspan="2">성별</th>
                    <th rowspan="2">기준성적</th>
                    <th colspan="3">이전학적</th>
                </tr>
                <tr>
                    <th>학년</th>
                    <th>반</th>
                    <th>번호</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector("tbody");

        classData[cls].forEach((student, index) => {
            const row = document.createElement("tr");
            row.className = "student-row";

            // 이전학적 정보 분리
            const previous = student.이전학적 ? student.이전학적.split(" ") : [];
            const previousGrade = previous[0] || "";
            const previousClass = previous[1] || "";
            const previousNumber = previous[2] || "";

            // 반별 배경 색상 정의
            const classColors = {
                "1": "#ffcccc", // 1반: 연한 빨강
                "2": "#ccffcc", // 2반: 연한 초록
                "3": "#ccccff", // 3반: 연한 파랑
                "4": "#e0ccff", // 4반: 연한 보라
                "5": "#ffedcc", // 5반: 연한 주황
                "6": "#ccffff", // 6반: 연한 청록
                "7": "#ffd9cc", // 7반: 연한 갈색
                "8": "#ffccf2"  // 8반: 연한 분홍
            };

            const classBackgroundColor = classColors[previousClass] || "#ffffff"; // 기본값: 흰색

            row.innerHTML = `
                <td>${student.번호}</td>
                <td>${student.성명}</td>
                <td>${student.생년월일}</td>
                <td>${student.성별}</td>
                <td>${student.기준성적}</td>
                <td>${previousGrade}</td>
                <td style="background-color: ${classBackgroundColor}; font-weight: bold;">${previousClass}</td>
                <td>${previousNumber}</td>
            `;

            if (changedStudents.has(`${cls}-${index}`)) {
                row.classList.add("changed");
            }

            row.addEventListener("click", () => selectStudent(cls, index, row));
            tbody.appendChild(row);
        });

        classBox.appendChild(table);

        const swapButtonContainer = document.createElement("div");
        swapButtonContainer.className = "swap-button-container";
        const swapButton = document.createElement("button");
        swapButton.textContent = "바꾸기";
        swapButton.className = "swap-button";
        swapButton.disabled = true;
        swapButton.addEventListener("click", swapStudents);
        swapButtonContainer.appendChild(swapButton);
        classBox.appendChild(swapButtonContainer);

        container.appendChild(classBox);
    });

    updateSwapButtonState();
}




function selectStudent(cls, index, element) {
    const selectedIndex = selectedStudents.findIndex(
        (student) => student.cls === cls && student.index === index
    );

    if (selectedIndex !== -1) {
        // 이미 선택된 학생이면 선택 해제
        selectedStudents.splice(selectedIndex, 1);
        element.classList.remove("selected");
    } else if (selectedStudents.length < 2) {
        // 새로운 학생 선택
        selectedStudents.push({ cls, index });
        element.classList.add("selected");
    }

    updateSwapButtonState();
}

function updateSwapButtonState() {
    const buttons = document.querySelectorAll(".swap-button");
    buttons.forEach((button) => {
        button.disabled = selectedStudents.length !== 2;
    });
}


function swapStudents() {
    const [first, second] = selectedStudents;

    // 같은 반 학생인지 확인
    if (first.cls === second.cls) {
        const userConfirmed = confirm(
            "같은 반 학생 2명을 선택했습니다. 그래도 바꾸시겠습니까?"
        );

        if (!userConfirmed) {
            // 사용자가 "아니오"를 선택한 경우 교환 취소
            selectedStudents = [];
            renderClasses();
            return;
        }
    }

    // 교환 로직
    const temp = classData[first.cls][first.index];
    classData[first.cls][first.index] = classData[second.cls][second.index];
    classData[second.cls][second.index] = temp;

    changedStudents.add(`${first.cls}-${first.index}`);
    changedStudents.add(`${second.cls}-${second.index}`);

    history.push(`${first.cls}반의 ${temp.성명} ⇔ ${second.cls}반의 ${classData[first.cls][first.index].성명}`);
    renderHistory();

    updateServerData();

    // 선택 초기화 및 다시 렌더링
    selectedStudents = [];
    renderClasses();
}



function renderHistory() {
    const historyList = document.getElementById("historyList");
    historyList.innerHTML = "";
    history.forEach((entry) => {
        const listItem = document.createElement("li");
        listItem.textContent = entry;
        historyList.appendChild(listItem);
    });
}
