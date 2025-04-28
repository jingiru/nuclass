let classData = {};
let selectedStudents = [];
let history = [];
let changedStudents = new Set();
let movedStudents = new Set();
let isNotesVisible = false;

selectedStudents = []; // 선택 초기화
updateButtonState(); // 버튼 상태 업데이트


document.getElementById("pdfUpload").addEventListener("change", async (event) => {
    const file = event.target.files[0];

    if (!file) {
        alert("PDF 파일을 선택해주세요.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();

        if (response.ok && result.message === "PDF 처리 및 저장 완료") {
            alert("PDF 업로드 및 저장이 완료되었습니다!");
            classData = result.data;
            renderClasses();
        } else {
            alert(result.message || "파일 처리 실패");
        }
    } catch (error) {
        console.error("PDF 업로드 중 오류 발생:", error);
    }
});




document.getElementById("downloadExcelButton").addEventListener("click", () => {
    window.location.href = "/download";
});

document.getElementById("globalSwapButton").addEventListener("click", () => {
    if (selectedStudents.length !== 2) {
        alert("두 명의 학생을 선택해야 합니다.");
        return;
    }
    swapStudents();
});


document.getElementById("globalMoveButton").addEventListener("click", () => {
    if (selectedStudents.length === 0) {
        alert("이동할 학생을 선택하세요.");
        return;
    }
    moveStudents();
});


/*
특이사항 아직 미구현
document.getElementById("toggleNotesCheckbox").addEventListener("change", function () {
    const studentTables = document.querySelectorAll(".student-table");
    studentTables.forEach(table => {
        if (this.checked) {
            table.classList.add("notes-visible");
        } else {
            table.classList.remove("notes-visible");
        }
    });
});

*/




async function updateServerData() {
    try {
        const response = await fetch("/update_data", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(classData),
        });

        if (response.ok) {
            console.log("데이터가 성공적으로 저장되었습니다.");
        } else {
            console.error("데이터 저장 실패");
        }
    } catch (error) {
        console.error("서버 데이터 저장 중 오류 발생:", error);
    }
}

// '바꾸기' 버튼 클릭 시 저장
document.getElementById("globalSwapButton").addEventListener("click", async () => {
    swapStudents(); // 기존 동작
    await updateServerData(); // 서버에 데이터 저장
});

// '다른 반으로 이동' 버튼 클릭 시 저장
document.getElementById("globalMoveButton").addEventListener("click", async () => {
    moveStudents(); // 기존 동작
    await updateServerData(); // 서버에 데이터 저장
});




//추가 코드

async function loadClassData() {
    try {
        const response = await fetch("/load_data");
        const result = await response.json();

        if (response.ok && result.success) {
            classData = result.data;
            renderClasses(); // 기존 UI 렌더링
        } else {
            alert(result.message || "데이터 로드 실패");
        }
    } catch (error) {
        console.error("데이터 로드 중 오류 발생:", error);
    }
}

// 로그인 성공 후 데이터 로드
if (window.location.pathname === "/dashboard") {
    loadClassData(); // 로그인 후 자동으로 데이터 로드
}



// 로그아웃 버튼 기능 추가
const logoutBtn = document.getElementById("logoutButton");

logoutBtn.addEventListener("click", async () => {
    const confirmLogout = confirm("정말 로그아웃 하시겠습니까?");
    if (!confirmLogout) return;

    try {
        const response = await fetch("/logout", { method: "POST" });
        if (response.ok) {
            window.location.href = "/"; // 로그인 페이지로 이동
        } else {
            alert("로그아웃 실패");
        }
    } catch (error) {
        console.error("로그아웃 중 오류:", error);
    }
});



async function updateStudentState(cls, index, state) {
    try {
        const response = await fetch("/update_student_state", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ class: cls, index, state }),
        });

        if (response.ok) {
            console.log("학생 상태가 성공적으로 저장되었습니다.");
        } else {
            console.error("학생 상태 저장 실패");
        }
    } catch (error) {
        console.error("학생 상태 저장 중 오류 발생:", error);
    }
}



// 예: '바꾸기' 버튼 클릭 시 상태 업데이트
document.getElementById("globalSwapButton").addEventListener("click", async () => {
    const [first, second] = selectedStudents;
    swapStudents(); // 기존 교환 로직
    await updateStudentState(first.cls, first.index, "changed");
    await updateStudentState(second.cls, second.index, "changed");
});

// 예: '다른 반으로 이동' 버튼 클릭 시 상태 업데이트
document.getElementById("globalMoveButton").addEventListener("click", async () => {
    moveStudents(); // 기존 이동 로직
    for (const student of selectedStudents) {
        await updateStudentState(student.cls, student.index, "moved");
    }
});



function renderStatistics() {
    const statsContainer = document.getElementById("currentStats");

    const thead = statsContainer.querySelector("thead");
    const tbody = statsContainer.querySelector("tbody");

    const numClasses = Object.keys(classData).length; // 🔥 반 개수 동적

    // ✅ [추가] 헤더도 반 개수에 맞춰 동적으로 재생성
    thead.innerHTML = ""; 
    let headerRow = `
        <tr>
            <th>구분</th>
            <th>합계</th>
    `;
    for (let i = 1; i <= numClasses; i++) {
        headerRow += `<th>이전 ${i}반</th>`;
    }
    headerRow += `
            <th>기준성적 평균</th>
            <th>기준성적 최고점(이름)</th>
            <th>기준성적 최저점(이름)</th>
        </tr>
    `;
    thead.innerHTML = headerRow;

    tbody.innerHTML = "";

    // Create a structure to hold statistics per class
    const classStats = {};
    Object.keys(classData).forEach(cls => {
        const students = classData[cls];
        let totalScore = 0;
        let maxScore = -Infinity;
        let minScore = Infinity;
        let maxStudent = "";
        let minStudent = "";
        const previousClassCount = Array(numClasses).fill(0); // ✅ 8 → numClasses로 수정

        students.forEach(student => {
            const score = parseFloat(student.기준성적 || 0);
            if (score > maxScore) {
                maxScore = score;
                maxStudent = student.성명;
            }
            if (score < minScore) {
                minScore = score;
                minStudent = student.성명;
            }
            totalScore += score;

            // Previous class statistics
            const previous = student.이전학적 ? student.이전학적.split(" ") : [];
            const previousClass = parseInt(previous[1] || 0, 10) - 1; // Convert to 0-based index
            if (previousClass >= 0 && previousClass < numClasses) {
                previousClassCount[previousClass] += 1;
            }
        });

        classStats[cls] = {
            studentCount: students.length,
            avgScore: students.length ? (totalScore / students.length).toFixed(2) : "-",
            maxScore,
            maxStudent,
            minScore,
            minStudent,
            previousClassCount
        };
    });

    // Populate table rows
    Object.keys(classStats)
    .sort((a, b) => {
        const [gradeA, classA] = a.split('-').map(Number);
        const [gradeB, classB] = b.split('-').map(Number);
        if (gradeA !== gradeB) return gradeA - gradeB;
        return classA - classB;
    })
    .forEach(cls => {
        const stats = classStats[cls];
        const row = document.createElement("tr");

        const maxCount = Math.max(...stats.previousClassCount);
        const minCount = Math.min(...stats.previousClassCount);

        row.innerHTML = `
            <td>${cls}</td>
            <td>${stats.studentCount}</td>
            ${stats.previousClassCount.map((count) => {
                let highlightColor = "";
                if (count === maxCount && stats.previousClassCount.filter(c => c === maxCount).length === 1) {
                    highlightColor = "background-color: #ffcccc;"; // 연한 빨간색
                } else if (count === minCount && stats.previousClassCount.filter(c => c === minCount).length === 1) {
                    highlightColor = "background-color: #cce5ff;"; // 연한 파란색
                }
                return `<td style="${highlightColor}">${count}</td>`;
            }).join("")}
            <td>${stats.avgScore}</td>
            <td>${stats.maxScore !== -Infinity ? `${stats.maxScore} (${stats.maxStudent})` : "-"}</td>
            <td>${stats.minScore !== Infinity ? `${stats.minScore} (${stats.minStudent})` : "-"}</td>
        `;

        tbody.appendChild(row);
    });
}




function renderClasses() {
    const container = document.getElementById("classesContainer");
    container.innerHTML = "";

    Object.keys(classData)
    .sort((a, b) => {
        const [gradeA, classA] = a.split('-').map(Number);
        const [gradeB, classB] = b.split('-').map(Number);
        if (gradeA !== gradeB) return gradeA - gradeB;
        return classA - classB;
    })
    .forEach((cls) => {
        const [grade, classNumber] = cls.split("-"); // 학년과 반 번호 분리
        const displayClassName = `${classNumber}반`; // 사용자에게 표시할 이름

        const classBox = document.createElement("div");
        classBox.className = "class-box";
        classBox.innerHTML = `<h3>${displayClassName}</h3>`;

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
                    <th class="notes-column" rowspan="2">특이사항</th>
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
                
                /*
                특이사항 미구현
                <td class="notes-column">
                    <input type="text" class="notes-input" data-class="${cls}" data-index="${index}">
                </td>
                */


            // 색상 표시: 교환과 이동 상태를 구분
            if (changedStudents.has(`${cls}-${index}`)) {
                row.style.backgroundColor = "#FFFACD"; // 연한 노란색 (교환된 학생)
            } else if (movedStudents.has(`${cls}-${index}`)) {
                row.style.backgroundColor = "#D1F2EB"; // 연한 녹색 (이동된 학생)
            }

            row.addEventListener("click", () => selectStudent(cls, index, row));
            tbody.appendChild(row);
        });

        classBox.appendChild(table);

        // Add '바꾸기' 버튼
        const swapButtonContainer = document.createElement("div");
        swapButtonContainer.className = "swap-button-container";
        const swapButton = document.createElement("button");
        swapButton.textContent = "바꾸기";
        swapButton.className = "swap-button";
        swapButton.disabled = true;
        swapButton.addEventListener("click", swapStudents);
        swapButtonContainer.appendChild(swapButton);
        classBox.appendChild(swapButtonContainer);

        // Add '다른 반으로 이동' 버튼
        const moveButton = document.createElement("button");
        moveButton.textContent = "다른 반으로 이동";
        moveButton.className = "move-button";
        moveButton.disabled = true; // 초기 비활성화
        moveButton.addEventListener("click", () => moveStudents(cls)); // 클릭 이벤트 추가
        swapButtonContainer.appendChild(moveButton);


        container.appendChild(classBox);
    });

    updateSwapButtonState();
    renderStatistics();
}







function selectStudent(cls, index, element) {
    const selectedIndex = selectedStudents.findIndex(
        (student) => student.cls === cls && student.index === index
    );

    if (selectedIndex !== -1) {
        // 이미 선택된 학생이면 선택 해제
        selectedStudents.splice(selectedIndex, 1);
        element.classList.remove("selected");
    } else {
        // 새로운 학생 선택
        selectedStudents.push({ cls, index });
        element.classList.add("selected");
    }

    // 버튼 상태 업데이트
    updateButtonState();
}

function updateButtonState() {
    const swapButtons = document.querySelectorAll(".swap-button");
    const moveButtons = document.querySelectorAll(".move-button");

    // '바꾸기' 버튼 활성화 조건: 선택한 학생이 정확히 2명일 때
    swapButtons.forEach((button) => {
        button.disabled = selectedStudents.length !== 2;
    });

    // '다른 반으로 이동' 버튼 활성화 조건: 선택한 학생이 1명 이상일 때
    moveButtons.forEach((button) => {
        button.disabled = selectedStudents.length === 0;
    });
}




function updateSwapButtonState() {
    const buttons = document.querySelectorAll(".swap-button");
    buttons.forEach((button) => {
        button.disabled = selectedStudents.length !== 2;
    });

    // Update '다른 반으로 이동' 버튼 상태
    const moveButtons = document.querySelectorAll(".move-button");
    moveButtons.forEach((button) => {
        button.disabled = selectedStudents.length === 0; // 학생 선택 여부에 따라 활성화
    });

}

// 학생 교환 함수
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

    const [fromGrade1, fromClassNumber1] = first.cls.split("-");
    const [toGrade2, toClassNumber2] = second.cls.split("-");

    history.push(`(바꿈) ${fromClassNumber1}반 ${temp.성명} ⇔ ${toClassNumber2}반 ${classData[first.cls][first.index].성명}`);

    renderHistory();

    updateServerData();

    // 선택 초기화 및 다시 렌더링
    selectedStudents = [];
    renderClasses();
}


// 학생 이동 함수
function moveStudents(sourceClass = null) {
    if (selectedStudents.length === 0) {
        alert("이동할 학생을 선택하세요.");
        return;
    }

    let currentGrade = null;

    if (sourceClass) {
        currentGrade = sourceClass.split("-")[0]; // 특정 학급에서 호출된 경우
    } else {
        const firstStudentClass = selectedStudents[0].cls;
        currentGrade = firstStudentClass.split("-")[0]; // 최상단 버튼에서 호출된 경우
    }

    const targetClassInput = prompt("어느 반으로 이동하시겠습니까? (반 숫자만 입력, 예: 1)");

    if (!targetClassInput || isNaN(targetClassInput)) {
        alert("유효한 반 숫자를 입력하세요.");
        return;
    }

    const targetClass = `${currentGrade}-${targetClassInput}`;

    if (!classData[targetClass]) {
        alert(`${currentGrade}학년 ${targetClassInput}반은 유효하지 않습니다. 다시 입력하세요.`);
        return;
    }

    // 이동할 학생 추적 및 기존 반에서 제거
    const movingStudents = [];
    selectedStudents.forEach(({ cls, index }) => {
        const student = classData[cls][index];
        if (!student) {
            console.error(`학생 데이터가 손실되었습니다: ${cls}, ${index}`);
            return;
        }
        movingStudents.push({ ...student, fromClass: cls, toClass: targetClass }); // 이동 전후 데이터 저장
    });

    // 원래 반에서 학생 제거
    selectedStudents.forEach(({ cls, index }) => {
        classData[cls] = classData[cls].filter((_, i) => i !== index);
    });

    // 새로운 반으로 학생 추가
    movingStudents.forEach((student) => {
        classData[targetClass].push(student);
        movedStudents.add(`${targetClass}-${classData[targetClass].length - 1}`); // movedStudents에 추가
    });

    // 이동 이력 추가
    movingStudents.forEach((student) => {
        const [fromGrade, fromClassNumber] = student.fromClass.split("-");
        const [toGrade, toClassNumber] = student.toClass.split("-");
        const fromDisplayClass = `${fromClassNumber}반`;
        const toDisplayClass = `${toClassNumber}반`;

        history.push(`(이동) ${fromDisplayClass} ${student.성명} → ${toDisplayClass}`);
    });

    renderHistory(); // 변경 이력 업데이트
    updateServerData(); // 서버 데이터 업데이트
    renderClasses(); // UI 업데이트

    // 초기화 및 버튼 상태 갱신
    selectedStudents = []; // 선택 초기화
    updateButtonState(); // 버튼 상태 갱신

    alert("학생 이동이 완료되었습니다.");
}


document.getElementById("resetClassDataButton").addEventListener("click", async () => {
    const userConfirmed = confirm("현재 학년 데이터를 초기화하시겠습니까? 되돌릴 수 없습니다.");
    if (!userConfirmed) return;

    try {
        const response = await fetch("/reset_class_data", { method: "POST" });
        const result = await response.json();

        if (response.ok && result.success) {
            alert(result.message);
            classData = {}; // 현재 학년 데이터 초기화
            renderClasses(); // UI 재렌더링
        } else {
            alert(result.message || "데이터 초기화 실패");
        }
    } catch (error) {
        console.error("데이터 초기화 중 오류 발생:", error);
    }
});







function renderHistory() {
    const historyList = document.getElementById("historyList");
    historyList.innerHTML = "";
    history.forEach((entry) => {
        const listItem = document.createElement("li");
        listItem.textContent = entry;
        historyList.appendChild(listItem);
    });
}

