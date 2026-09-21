// Runs synchronously while the HTML is parsed, so the right theme is applied
// before first paint (no light-to-dark flash). Keep in sync with ThemeToggle.
export const themeScript = `(function(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)})()`;
