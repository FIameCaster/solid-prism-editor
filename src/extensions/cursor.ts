import { Extension } from "../types"
import { onCleanup, createComputed } from "solid-js"
import { getLineBefore } from "../utils"
import { addListener, getLineEnd, scrollToEl } from "../utils/local"
import { template } from "solid-js/web"
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
	"<div style=position:absolute;top:0;opacity:0;padding:inherit> <span><span></span> ",
)

/**
 * Extension making it easier to calculate the position of the cursor and scroll it into view.
 * This is used by {@link defaultCommands} to keep the cursor in view while typing.
 *
 * Once called, the extension can be accessed from `editor.extensions.cursor`.
 */
export const cursorPosition = (): Extension => editor => {
	let prevBefore = " "
	let prevAfter = " "

	const container = cursorTemplate() as HTMLDivElement
	const [before, span] = container.childNodes as unknown as [Text, HTMLSpanElement]
	const [cursor, after] = span.childNodes as unknown as [HTMLSpanElement, Text]
	const scrollIntoView = () => scrollToEl(editor, cursor)

	const remove = addListener(editor, "input", e => {
		if (/history/.test((e as InputEvent).inputType)) scrollIntoView()
	})

	createComputed(() => {
		let selection = editor.selection()
		let value = editor.value
		let position = selection[selection[2] < "f" ? 0 : 1]
		let newBefore = getLineBefore(value, position)
		let newAfter = value.slice(position, getLineEnd(value, position))
		let index = editor.activeLine
		let activeLine = editor.lines[index]

		if (index) {
			if (!newBefore && !newAfter) newAfter = " "
			if (prevBefore != newBefore) before.data = prevBefore = newBefore
			if (prevAfter != newAfter) after.data = prevAfter = newAfter
			if (container.parentNode != activeLine) activeLine.prepend(container)
		}
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
