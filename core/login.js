/* Login screen: pick user -> mobile prefilled (editable) -> OTP. */
function showLogin(onSuccess) {
  const root = document.getElementById("login");
  document.getElementById("app").hidden = true;
  root.hidden = false;
  root.innerHTML = `
    <div class="login-card">
      <div class="brand login-brand"><span class="brand-mark">◈</span><span class="brand-text">SITEGRID</span></div>
      <div class="login-sub">Sign in with your registered mobile number</div>
      <label class="login-label" for="loginUser">Select user (demo)</label>
      <select id="loginUser">${USERS.map((u) =>
        `<option value="${u.id}">${u.name} — ${roleName(u.roleId)}${u.active ? "" : " (Inactive)"}</option>`).join("")}</select>
      <label class="login-label" for="loginMobile">Mobile number</label>
      <input id="loginMobile" type="tel" inputmode="numeric" maxlength="14" autocomplete="off" />
      <div id="otpBlock" hidden>
        <label class="login-label" for="loginOtp">OTP <span class="dim">(demo OTP: ${DEMO_OTP})</span></label>
        <input id="loginOtp" type="text" inputmode="numeric" maxlength="4" autocomplete="off" />
      </div>
      <div class="login-error" id="loginError" role="alert"></div>
      <button class="btn teal login-btn" id="loginBtn">Send OTP</button>
      <a class="login-reset" id="loginReset" href="#">Reset demo data</a>
    </div>`;
  const $ = (id) => document.getElementById(id);
  const err = (m) => { $("loginError").textContent = m || ""; };
  const fillMobile = () => { $("loginMobile").value = byId(USERS, Number($("loginUser").value)).mobile; };
  let otpSent = false;
  const resetStep = () => { otpSent = false; $("otpBlock").hidden = true; $("loginOtp").value = ""; $("loginBtn").textContent = "Send OTP"; err(""); };

  fillMobile();
  $("loginUser").onchange = () => { fillMobile(); resetStep(); };
  $("loginMobile").oninput = resetStep;
  $("loginReset").onclick = (e) => { e.preventDefault(); Store.reset(); };
  $("loginBtn").onclick = () => {
    if (!otpSent) {
      const r = Auth.requestOtp($("loginMobile").value);
      if (!r.ok) return err(r.error);
      otpSent = true; err("");
      $("otpBlock").hidden = false; $("loginOtp").focus(); $("loginBtn").textContent = "Verify & Sign in";
      return;
    }
    const r = Auth.verifyOtp($("loginMobile").value, $("loginOtp").value);
    if (!r.ok) return err(r.error);
    hideLogin(); onSuccess(r.user);
  };
  root.onkeydown = (e) => { if (e.key === "Enter") $("loginBtn").click(); };
}
function hideLogin() {
  document.getElementById("login").hidden = true;
  document.getElementById("app").hidden = false;
}
