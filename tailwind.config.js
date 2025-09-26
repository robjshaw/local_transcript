/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}", "./views/**/*.{html,js,ejs}"],
  theme: {
    extend: {
      colors: {
        'legal-blue': '#1e3a8a',
        'legal-gray': '#374151',
        'success-green': '#10b981',
        'warning-amber': '#f59e0b'
      }
    },
  },
  plugins: [],
}