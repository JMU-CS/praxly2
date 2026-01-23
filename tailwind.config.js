/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./sandbox.html",
        "./embed.html",
        "./main.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#4f46e5',
                secondary: '#0f172a',
            }
        },
    },
    plugins: [],
}
