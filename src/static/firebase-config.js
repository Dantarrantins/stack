/* Which Firebase project this copy of Stack talks to.
   - live:    the real app (production hosts below) → project stack-d5236
   - preview: branch previews and anything else → a separate test project, so testing never touches real accounts
   - local:   localhost / CI → no accounts, data stays on the device (add ?cloud=preview to test sign-in locally)
   These values are meant to be public; access is protected by Firestore rules and Firebase Auth. */
(function () {
  const PROJECTS = {
    live: {
      apiKey: "AIzaSyA64fxyfzhnq6Q114zg-RF-iqxR4EGGrsM",
      authDomain: "stack-d5236.firebaseapp.com",
      projectId: "stack-d5236",
      storageBucket: "stack-d5236.firebasestorage.app",
      messagingSenderId: "472991282036",
      appId: "1:472991282036:web:007abc973c23c39bc77221"
    },
    preview: {
      apiKey: "AIzaSyCj_AQZQRwSx4Xt712ChkYumJP159pgkWM",
      authDomain: "stack-preview.firebaseapp.com",
      projectId: "stack-preview",
      storageBucket: "stack-preview.firebasestorage.app",
      messagingSenderId: "1071410364946",
      appId: "1:1071410364946:web:a6689a8d8aad6753a18ecb"
    }
  };
  const LIVE_HOSTS = ["dantarrantins.github.io", "stack-app.pages.dev", "stack.design-narrative.com"];
  const host = location.hostname;
  const q = new URLSearchParams(location.search);
  let env;
  if (host === "localhost" || host === "127.0.0.1") env = q.get("cloud") === "preview" ? "preview" : "local";
  else env = LIVE_HOSTS.includes(host) ? "live" : "preview";
  window.STACK_ENV = env;
  window.STACK_FIREBASE = env === "local" ? null : PROJECTS[env];
})();
