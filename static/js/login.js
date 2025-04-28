document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const schoolCode = document.getElementById("schoolCodeInput").value.trim();
  const grade = document.getElementById("gradeInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();
  const messageDiv = document.getElementById("loginMessage");

  if (!schoolCode || !grade || !password) {
    messageDiv.textContent = "학교코드, 학년, 비밀번호를 모두 입력해주세요.";
    return;
  }

  try {
    const apiUrl = `https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=1&KEY=11208a28a1574d868608e12816c43830&SD_SCHUL_CODE=${schoolCode}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.schoolInfo || !data.schoolInfo[1]?.row[0]) {
      messageDiv.textContent = "유효한 학교코드가 아닙니다. 다시 입력해주세요.";
      return;
    }

    const schoolName = data.schoolInfo[1].row[0].SCHUL_NM;
    const confirmResult = confirm(`학교명: ${schoolName}\n\n이 학교가 맞습니까?`);

    if (!confirmResult) {
      // 취소 누르면 입력창 초기화
      document.getElementById("schoolCodeInput").value = "";
      document.getElementById("gradeInput").value = "";
      document.getElementById("passwordInput").value = "";
      return;
    }

    // ✅ [여기 추가] 학교명 확인 후 서버로 로그인 요청 보내기!
    const loginResponse = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolCode, grade, password }),
    });

    const result = await loginResponse.json();
    if (loginResponse.ok && result.success) {
      window.location.href = "/dashboard";
    } else {
      messageDiv.textContent = result.message || "로그인 실패";
    }
  } catch (error) {
    console.error("로그인 중 오류 발생:", error);
    messageDiv.textContent = "로그인 중 오류가 발생했습니다.";
  }
});
