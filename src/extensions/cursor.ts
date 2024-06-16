import { Extension } from "../types"
import { createSignal, createEffect, onMount, onCleanup } from "solid-js"
import { getLineBefore } from "../utils"
import { addListener, getLineEnd, scrollToEl } from "../utils/local"
import { insert, template } from "solid-js/web"
import { defaultCommands } from "./commands"

/** Postion of the cursor relative to the editors overlays. */
export type CursorPosition = {
	top: number
	bottom: number
	left: number
	right: number
	height: number
}

export interface Cursor {
	/** Gets the cursor position relative to the editor's overlays. */
	getPosition(): CursorPosition
	/** Scrolls the cursor into view. */
	scrollIntoView(): void
}

const cursorTemplate = template(
	"<div style=position:absolute;top:0;opacity:0;padding:inherit><span><span>",
)

/**
 * Extension making it easier to calculate the position of the cursor and scroll it into view.
 * This is used by {@link defaultCommands} to keep the cursor in view while typing.
 * 
 * Once called, the extension can be accessed from `editor.extensions.cursor`.
 */
export const cursorPosition = (): Extension => editor => {
	const [before, setBefore] = createSignal("")
	const [after, setAfter] = createSignal("")

	const container = cursorTemplate() as HTMLDivElement
	const span = container.firstChild as HTMLSpanElement
	const cursor = span.firstChild as HTMLSpanElement
	const scrollIntoView = () => scrollToEl(editor, cursor)

	const remove = addListener(editor, "input", e => {
		if (/history/.test((e as InputEvent).inputType)) scrollIntoView()
	})

	insert(container, before, span)
	insert(span, after, null)

	createEffect(() => {
		const selection = editor.selection()
		const value = editor.value
		const position = selection[selection[2] < "f" ? 0 : 1]
		const newBefore = getLineBefore(value, position)
		const newAfter = value.slice(position, getLineEnd(value, position))
		const activeLine = editor.lines[editor.activeLine]

		setBefore(newBefore)
		setAfter(newBefore || newAfter ? newAfter : "\n")
		if (container.parentNode != activeLine) activeLine.prepend(container)
	})

	onCleanup(() => {
		delete editor.extensions.cursor
		container.remove()
		remove()
	})

	editor.extensions.cursor = {
		scrollIntoView,
		getPosition() {
			const rect1 = cursor.getBoundingClientRect()
			const rect2 = editor.lines[0].getBoundingClientRect()

			return {
				top: rect1.y - rect2.y,
				bottom: rect2.bottom - rect1.bottom,
				left: rect1.x - rect2.x,
				right: rect2.right - rect1.x,
				height: rect1.height,
			}
		},
	}
}
