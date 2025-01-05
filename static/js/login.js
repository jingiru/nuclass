// login.js
document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault(); // 기본 폼 제출 동작 막기

    const name = document.getElementById("nameInput").value.trim(); // 입력 값 가져오기
    const messageDiv = document.getElementById("loginMessage"); // 메시지를 표시할 div

    // 입력값 검증
    if (!name) {
        messageDiv.textContent = "이름 또는 학년을 입력해주세요.";
        return;
    }

    try {
        // 서버로 POST 요청 보내기
        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json", // JSON 요청
            },
            body: JSON.stringify({ name }), // 입력값 전송
        });

        const result = await response.json(); // 서버 응답 받기

        // 서버 응답 처리
        if (response.ok && result.success) {
            console.log("로그인 성공! 페이지 이동"); // 디버깅 로그
            window.location.href = "/dashboard"; // 로그인 성공 시 페이지 이동
        } else {
            // 실패 시 메시지 표시
            messageDiv.textContent = result.message || "로그인 실패";
            console.error("로그인 실패: ", result.message); // 디버깅 로그
        }
    } catch (error) {
        // 네트워크 또는 서버 오류 처리
        console.error("로그인 중 오류 발생:", error);
        messageDiv.textContent = "로그인 중 오류가 발생했습니다.";
    }
});
