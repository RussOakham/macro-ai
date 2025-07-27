import { z } from 'zod'

const postChatsIdstream_Body = z
	.object({
		messages: z
			.array(
				z
					.object({
						role: z.enum(['user', 'assistant', 'system']),
						content: z.string().min(1).max(10000),
					})
					.passthrough(),
			)
			.min(1),
	})
	.passthrough()

// Individual exports for direct access
export { postChatsIdstream_Body }
