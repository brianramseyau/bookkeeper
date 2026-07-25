const currencyFormatter = new Intl.NumberFormat('en-AU', {
	style: 'currency',
	currency: 'AUD',
})

export function formatCurrency(amount: number | null): string {
	if (amount === null) return '—'
	return currencyFormatter.format(amount)
}

const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]

export function monthName(month: number): string {
	return MONTH_NAMES[month - 1] ?? String(month)
}

export function monthShortName(month: number): string {
	return monthName(month).slice(0, 3)
}
