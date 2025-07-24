/**
 * Chat interface constants
 * Shared constants used throughout the chat interface components
 */

/**
 * Auto-scroll delay in milliseconds
 * Used to ensure DOM updates are complete before scrolling
 */
export const AUTO_SCROLL_DELAY = 100

/**
 * Chat status types
 */
export const CHAT_STATUS = {
	READY: 'ready',
	SUBMITTED: 'submitted',
	STREAMING: 'streaming',
	ERROR: 'error',
} as const

/**
 * Message roles
 */
export const MESSAGE_ROLES = {
	USER: 'user',
	ASSISTANT: 'assistant',
	SYSTEM: 'system',
	DATA: 'data',
} as const

/**
 * Keyboard shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
	SUBMIT: 'Enter',
	NEW_LINE: 'Shift+Enter',
} as const

/**
 * CSS class names for consistent styling
 */
export const CSS_CLASSES = {
	FLEX_CONTAINER: 'flex-1 flex flex-col h-full bg-background min-h-0',
	HEADER_CONTAINER: 'border-b border-border p-4 flex-shrink-0',
	MESSAGES_CONTAINER: 'flex-1 overflow-y-auto min-h-0',
	EMPTY_STATE_CONTAINER: 'flex-1 flex items-center justify-center h-full',
	STATUS_INDICATOR: 'flex items-center gap-2 text-xs',
} as const

/**
 * Animation durations
 */
export const ANIMATIONS = {
	SCROLL_BEHAVIOR: 'smooth',
	PULSE_ANIMATION: 'animate-pulse',
} as const
