/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,jsx,js}"],
  theme: {
  	extend: {
  		colors: {
  			'mn-bg': '#020617',
  			'mn-bg-elevated': '#05081a',
  			'mn-primary': '#f97316',
  			'mn-primary-soft': '#fed7aa',
  			'mn-accent-teal': '#14b8a6',
  			'mn-accent-violet': '#a855f7',
  			'mn-text-primary': '#e5e7eb',
  			'mn-text-secondary': '#9ca3af',
  			'mn-text-muted': '#6b7280',
  			'mn-border-subtle': '#1f2937',
  			'mn-border-strong': '#4b5563',
  			'mn-success': '#22c55e',
  			'mn-warning': '#facc15',
  			'mn-error': '#f97373',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			ui: [
  				'Inter',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI"',
  				'sans-serif'
  			],
  			heading: [
  				'Space Grotesk"',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI"',
  				'sans-serif'
  			]
  		},
  		backgroundImage: {
  			'mn-hero': 'linear-gradient(135deg, #a855f7 0%, #22c55e 40%, #f97316 100%)'
  		},
  		boxShadow: {
  			'mn-soft': '0 18px 45px rgba(15, 23, 42, 0.75)',
  			'mn-card': '0 14px 35px rgba(15, 23, 42, 0.9)'
  		},
  		borderRadius: {
  			'mn-card': '1.5rem',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
