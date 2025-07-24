/**
 * The `formatRelativeDate` function takes a Date object or string and returns a formatted date string based
 * on the time difference from the current date.
 * @param {Date | string} date - The `date` parameter in the `formatRelativeDate` function can be either a
 * `Date` object or a string representing a date.
 * @returns The `formatRelativeDate` function returns a formatted date string based on the input date. If the
 * input date is today, it returns 'Today'. If the input date is yesterday, it returns 'Yesterday'. If
 * the input date is within the last 7 days, it returns the number of days ago. Otherwise, it returns
 * the input date formatted as a locale-specific date string.
 */
const formatRelativeDate = (date: Date | string) => {
	const now = new Date()
	const dateObj = date instanceof Date ? date : new Date(date)

	const diffInDays = Math.floor(
		(now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24),
	)

	if (diffInDays === 0) return 'Today'
	if (diffInDays === 1) return 'Yesterday'
	if (diffInDays < 7) return `${diffInDays.toString()} days ago`
	return dateObj.toLocaleDateString()
}

export { formatRelativeDate }
