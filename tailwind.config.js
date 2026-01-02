/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mint: '#00C896', // Adding your custom color here makes it easier to use
      }
    },
  },
  plugins: [],
}