import {
	For,
	createComponent,
	createRenderEffect,
	createSignal,
	mergeProps,
	on,
	onMount,
	untrack,
} from "solid-js"
import type {
	EditorProps,
	Language,
	PrismEditor,
	InputCommandCallback,
	InputSelection,
	KeyCommandCallback,
	Extension,
} from "./types"
import { TokenStream, highlightTokens, languages, tokenizeText } from "./prism"
import { insert, template } from "solid-js/web"

/**
 * The core editor component of the library.
 * @param props Props to customize some of the appearance and behavior of the editor.
 * @returns The container for the editor.
 */
const Editor = (props: Partial<EditorProps>) => {
	let handleSelecionChange = true
	let activeLine: Element
	let prevLines: string[] = []
	let language = ""
	let value = ""
	let prevValue: string
	let prevClass: string
	let activeLineNumber = 0
	let lineCount = 0
	let isFirstRender = true
	let editorProps: EditorProps = mergeProps({ language: "text", value }, props)

	const container = editorTemplate() as HTMLDivElement
	const wrapper = container.firstChild as HTMLDivElement
	const lines = wrapper.children as HTMLCollectionOf<HTMLDivElement>
	const overlays = lines[0]
	const textarea = overlays.firstChild as HTMLTextAreaElement

	const getInputSelection = (): InputSelection => [
		textarea.selectionStart,
		textarea.selectionEnd,
		textarea.selectionDirection,
	]

	const [selection, setSelection] = createSignal(getInputSelection())
	const [focused, setFocused] = createSignal(false)
	const [tokens, setTokens] = createSignal<TokenStream>([])

	const updateSelection = (force?: boolean) => {
		if (force || handleSelecionChange) {
			const selection = getInputSelection()
			const newLine =
				lines[(activeLineNumber = numLines(value, 0, selection[selection[2] < "f" ? 0 : 1]))]

			if (newLine != activeLine) {
				activeLine?.classList.remove("active-line")
				newLine.classList.add("active-line")
				activeLine = newLine
			}

			setSelection(selection)
		}
	}

	const keyCommandMap: Record<string, KeyCommandCallback | null> = {
		Escape() {
			textarea.blur()
		},
	}

	const inputCommandMap: Record<string, InputCommandCallback | null> = {}

	// Safari focuses the textarea if you change its selection or value programmatically
	const focusRelatedTarget = () => () =>
		isWebKit &&
		untrack(focused) &&
		addTextareaListener(
			editor,
			"focus",
			e => {
				let relatedTarget = e.relatedTarget as HTMLElement
				if (relatedTarget) relatedTarget.focus()
				else textarea.blur()
			},
			{ once: true },
		)

	const update = () => {
		setTokens(tokenizeText((value = textarea.value), languages[language] || {}))
	}

	const editor: PrismEditor = {
		inputCommandMap,
		keyCommandMap,
		extensions: {},
		props: editorProps,
		get value() {
			return value
		},
		selection,
		tokens,
		focused,
		get activeLine() {
			return activeLineNumber
		},
		container,
		wrapper,
		lines,
		textarea,
		update,
		getSelection: getInputSelection,
		setSelection(start, end = start, direction) {
			focusRelatedTarget()
			textarea.setSelectionRange(start, end, direction)
			updateSelection(true)
		},
	}

	createRenderEffect(() => {
		let readOnly = !!editorProps.readOnly
		textarea.inputMode = readOnly ? "none" : ""
		textarea.setAttribute("aria-readonly", readOnly as any)
	})

	createRenderEffect(() => {
		let newClass = `prism-code-editor language-${editorProps.language}${
			editorProps.lineNumbers == false ? "" : " show-line-numbers"
		} pce-${editorProps.wordWrap ? "" : "no"}wrap${editorProps.rtl ? " pce-rtl" : ""} pce-${
			selection()[0] < selection()[1] ? "has" : "no"
		}-selection${focused() ? " pce-focus" : ""}${editorProps.readOnly ? " pce-readonly" : ""}`
		if (prevClass != newClass) container.className = prevClass = newClass
	})

	createRenderEffect(() => {
		container.style.tabSize = editorProps.tabSize || (2 as any)
	})

	createRenderEffect(
		on(selection, s => {
			if (!isFirstRender) editorProps.onSelectionChange?.(s, value, editor)
		}),
	)

	createRenderEffect(() => {
		tokens()
		if (isFirstRender) return
		let newLines = highlightTokens(tokens()).split("\n")
		let start = 0
		let end2 = lineCount
		let end1 = (lineCount = newLines.length)

		// Manual dom manipulation is significantly faster here than using the <For> control flow
		while (newLines[start] == prevLines[start] && start < end1) ++start
		while (end1 && newLines[--end1] == prevLines[--end2]);

		if (start == end1 && start == end2) lines[start + 1].innerHTML = newLines[start] + "\n"
		else {
			let insertStart = end2 < start ? end2 : start - 1
			let i = insertStart
			let newHTML = ""

			while (i < end1) newHTML += `<div class=pce-line aria-hidden=true>${newLines[++i]}\n</div>`
			for (i = end1 < start ? end1 : start - 1; i < end2; i++) lines[start + 1].remove()
			if (newHTML) lines[insertStart + 1].insertAdjacentHTML("afterend", newHTML)
			for (i = insertStart + 1; i < lineCount; ) lines[++i].setAttribute("data-line", i as any)
			container.style.setProperty("--number-width", Math.ceil(Math.log10(lineCount + 1)) + ".001ch")
		}

		updateSelection(true)
		if (handleSelecionChange) setTimeout(setTimeout, 0, () => (handleSelecionChange = true))

		prevLines = newLines
		handleSelecionChange = false
	})

	createRenderEffect(
		on(tokens, () => {
			if (!isFirstRender) editorProps.onUpdate?.(value, editor)
		}),
	)

	createRenderEffect(() => {
		let newValue = editorProps.value
		if (prevValue != newValue) {
			focusRelatedTarget()
			textarea.value = prevValue = newValue
			textarea.selectionEnd = 0
		}
		language = editorProps.language
		isFirstRender = false
		update()
	})

	onMount(() => {
		editorProps.onMount?.(editor)
	})

	addTextareaListener(editor, "keydown", e => {
		keyCommandMap[e.key]?.(e, getInputSelection(), value) && preventDefault(e)
	})
	addTextareaListener(editor, "beforeinput", e => {
		if (
			editorProps.readOnly ||
			(e.inputType == "insertText" && inputCommandMap[e.data!]?.(e, getInputSelection(), value))
		)
			preventDefault(e)
	})
	addTextareaListener(editor, "input", update)
	addTextareaListener(editor, "blur", () => {
		selectionChange = null
		setFocused(false)
	})

	addTextareaListener(editor, "focus", () => {
		selectionChange = updateSelection
		setFocused(true)
	})

	// For browsers that support selectionchange on textareas
	addTextareaListener(editor, "selectionchange", e => {
		updateSelection()
		preventDefault(e)
	})

	insert(
		overlays,
		createComponent(For, {
			get each() {
				return editorProps.extensions
			},
			children: (extension: Extension) => extension(editor)!,
		}),
		null,
	)

	return container
}

/** Object storing all language specific behavior. */
const languageMap: Record<string, Language> = {}

const editorTemplate = template(
	"<div><div class=pce-wrapper><div class=pce-overlays><textarea spellcheck=false autocapitalize=off autocomplete=off>",
)

const preventDefault = (e: Event) => {
	e.preventDefault()
	e.stopImmediatePropagation()
}

const addTextareaListener = <T extends keyof HTMLElementEventMap>(
	editor: PrismEditor,
	type: T,
	listener: (this: HTMLTextAreaElement, ev: HTMLElementEventMap[T]) => any,
	options?: boolean | AddEventListenerOptions,
) => editor.textarea.addEventListener(type, listener, options)

const userAgent = navigator.userAgent
const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
const isChrome = /Chrome\//.test(userAgent)
const isWebKit = !isChrome && /AppleWebKit\//.test(userAgent)

/**
 * Counts number of lines in the string between `start` and `end`.
 * If start and end are excluded, the whole string is searched.
 */
const numLines = (str: string, start = 0, end = Infinity) => {
	let count = 1
	for (; (start = str.indexOf("\n", start) + 1) && start <= end; count++);
	return count
}

document.addEventListener("selectionchange", () => selectionChange?.())

let selectionChange: null | (() => void)

export {
	Editor,
	addTextareaListener,
	preventDefault,
	languageMap,
	isMac,
	isChrome,
	isWebKit,
	numLines,
}
