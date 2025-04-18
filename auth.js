// auth.js: Supabase authentication logic for login gating
(async () => {
  // Initialize Supabase client
  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
  // Expose client globally for other modules
  window.supabaseClient = supabaseClient;

  // Element references for auth UI
  const authToggle = document.getElementById("auth-toggle");
  const authForm = document.getElementById("auth-form");
  const authLoggedIn = document.getElementById("auth-logged-in");
  const userEmailSpan = document.getElementById("user-email");
  const logoutButton = document.getElementById("logout-button");

  const emailInput = document.getElementById("email-input");
  const passwordInput = document.getElementById("password-input");
  const loginButton = document.getElementById("login-button");
  const signupButton = document.getElementById("signup-button");
  const authError = document.getElementById("auth-error");

  // Display or hide UI based on auth state
  function updateUI(session) {
    if (session && session.user) {
      // hide login form and toggle link
      authToggle.style.display = 'none';
      authForm.style.display = 'none';
      authLoggedIn.style.display = 'block';
      userEmailSpan.textContent = session.user.email;
    } else {
      // show toggle link, hide logged-in panel and form
      authToggle.style.display = 'inline';
      authLoggedIn.style.display = 'none';
      authForm.style.display = 'none';
      userEmailSpan.textContent = '';
    }
  }

  // Get initial session
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  updateUI(session);

  // Listen for auth changes
  supabaseClient.auth.onAuthStateChange((_, session) => {
    updateUI(session);
  });

  // Toggle auth form visibility
  authToggle.addEventListener('click', () => {
    authForm.style.display = authForm.style.display === 'block' ? 'none' : 'block';
  });
  // Display errors
  function showError(msg) {
    authError.textContent = msg;
  }

  // Email/password sign up
  signupButton.addEventListener("click", async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return showError("Provide email and password");
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) showError(error.message);
    else showError("Sign-up successful! Check your email to confirm.");
  });

  // Email/password log in
  loginButton.addEventListener("click", async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return showError("Provide email and password");
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) showError(error.message);
    else showError("");
  });
  // GitHub OAuth log in
  const githubButton = document.getElementById('github-button');
  githubButton.addEventListener('click', async () => {
    authError.textContent = '';
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin }
    });
    if (error) showError(error.message);
  });

  // Log out
  logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });
})();

