package auth

import (
	"bytes"
	"html/template"
	"net/url"

	"github.com/gofiber/fiber/v3"
)

var resetPasswordPage = template.Must(template.New("reset-password").Parse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Reset CartRune password</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0d1021; color: #f5f7ff; }
    main { width: min(92vw, 420px); padding: 28px; border: 1px solid #303858; border-radius: 16px; background: #171b35; box-sizing: border-box; }
    h1 { margin-top: 0; font-size: 1.5rem; }
    label { display: block; margin: 16px 0 6px; color: #b8c0df; }
    input, button { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; font: inherit; }
    input { border: 1px solid #4b5680; background: #0d1021; color: inherit; }
    button { margin-top: 20px; border: 0; background: #7c6cff; color: white; cursor: pointer; font-weight: 700; }
    button:disabled { opacity: .6; cursor: wait; }
    #message { min-height: 1.5em; color: #b8c0df; }
    .error { color: #ff9d9d !important; }
    a { color: #a9a0ff; }
  </style>
</head>
<body>
  <main>
    <h1>Reset your password</h1>
    <p>Choose a new CartRune password. This link can only be used once.</p>
    <form id="reset-form">
      <label for="password">New password</label>
      <input id="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required>
      <label for="confirm">Confirm password</label>
      <input id="confirm" type="password" minlength="12" maxlength="128" autocomplete="new-password" required>
      <button id="submit" type="submit">Change password</button>
    </form>
    <p id="message" role="status"></p>
    <p><a href="{{.DeepLink}}">Open in the CartRune app</a></p>
  </main>
  <script>
    const token = {{.TokenJSON}};
    const form = document.getElementById('reset-form');
    const submit = document.getElementById('submit');
    const message = document.getElementById('message');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm').value;
      message.className = '';
      if (password.length < 12 || password.length > 128) {
        message.textContent = 'Password must be between 12 and 128 characters.';
        message.className = 'error';
        return;
      }
      if (password !== confirm) {
        message.textContent = 'Passwords do not match.';
        message.className = 'error';
        return;
      }
      submit.disabled = true;
      message.textContent = 'Updating password...';
      try {
        const response = await fetch('/api/v1/auth/password-reset/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        if (!response.ok) throw new Error('reset failed');
        form.remove();
        message.textContent = 'Password changed. You can now sign in to CartRune.';
      } catch (_) {
        message.textContent = 'This link is invalid, expired, or already used.';
        message.className = 'error';
        submit.disabled = false;
      }
    });
  </script>
</body>
</html>`))

// RenderResetPasswordPage provides a browser-based reset flow for users who
// open the email on a device without the CartRune app installed.
func RenderResetPasswordPage(c fiber.Ctx, token string) error {
	data := struct {
		TokenJSON template.JS
		DeepLink  string
	}{
		TokenJSON: template.JS(template.JSEscapeString(token)),
		DeepLink:  "cartrune://reset-password?token=" + url.QueryEscape(token),
	}
	var body bytes.Buffer
	if err := resetPasswordPage.Execute(&body, data); err != nil {
		return err
	}
	c.Set("Cache-Control", "no-store")
	c.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'")
	c.Type("html", "utf-8")
	return c.Send(body.Bytes())
}
