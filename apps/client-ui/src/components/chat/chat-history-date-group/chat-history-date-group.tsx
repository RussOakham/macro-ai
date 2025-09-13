interface ChatHistoryDateGroupProps {
	children: React.ReactNode
	dateGroup: string
}

const ChatHistoryDateGroup = ({
	children,
	dateGroup,
}: ChatHistoryDateGroupProps) => {
	return (
		<div className="py-2">
			<div className="px-3 py-2 text-xs text-muted-foreground font-medium">
				{dateGroup}
			</div>
			<div className="space-y-1">{children}</div>
		</div>
	)
}

export { ChatHistoryDateGroup }
