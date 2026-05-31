// Inline script to set the theme class before paint, preventing FOUC.
// Must read the SAME localStorage key the settings store writes
// (`northpay.ui.theme`) — otherwise the saved choice is lost on every load
// and the page flashes the system theme instead.
export function ThemeScript() {
  const code = `
    try {
      var raw = localStorage.getItem('northpay.ui.theme');
      var theme = raw ? JSON.parse(raw) : 'system';
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = theme === 'dark' || (theme === 'system' && prefersDark);
      var cl = document.documentElement.classList;
      if (isDark) cl.add('dark'); else cl.remove('dark');
    } catch (_) {}
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
