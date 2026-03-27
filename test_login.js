async function testLogin() {
    try {
        console.log("Testing POST to http://localhost:3000/api/admin/login ...");
        const res = await fetch("http://localhost:3000/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@gmail.com", password: "123456" })
        });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${text}`);

        if (res.status === 200) {
            console.log("\nTesting GET to http://localhost:3000/api/admin/intelligence/dashboard ...");
            const cookies = res.headers.get('set-cookie');
            if (cookies) {
                const adminToken = cookies.split(';')[0];
                const dbRes = await fetch("http://localhost:3000/api/admin/intelligence/dashboard", {
                    method: "GET",
                    headers: { "Cookie": adminToken }
                });
                const dbText = await dbRes.text();
                console.log(`Dashboard Status: ${dbRes.status}`);
                console.log(`Dashboard Body: ${dbText.substring(0, 200)}`);
            }
        }
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

testLogin();
