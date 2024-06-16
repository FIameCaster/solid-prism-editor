import { PrismEditor } from "../types"
import { addTextareaListener, isChrome } from "../core"

const scrollToEl = (editor: PrismEditor, el: HTMLElement, paddingTop = 0) => {
	const style1 = editor.container.style
	const style2 = document.documentElement.style

	style1.scrollPaddingBlock = style2.scrollPaddingBlock = `${paddingTop}px ${
		isChrome && !el.textContent ? el.offsetHeight : 0
	}px`

	el.scrollIntoView({ block: "nearest" })
	style1.scrollPaddingBlock = style2.scrollPaddingBlock = ""
}

const getLineStart = (text: string, position: number) =>
	position ? text.lastIndexOf("\n", position - 1) + 1 : 0

const getLineEnd = (text: string, position: number) =>
	(position = text.indexOf("\n", position)) + 1 ? position : text.length

const addListener = <T extends keyof HTMLElementEventMap>(
	editor: PrismEditor,
	type: T,
	listener: (this: HTMLTextAreaElement, ev: HTMLElementEventMap[T]) => any,
	options?: boolean | AddEventListenerOptions,
) => {
	addTextareaListener(editor, type, listener, options)
	return () => editor.textarea.removeEventListener(type, listener, options)
}

export { scrollToEl, getLineStart, getLineEnd, addListener }
