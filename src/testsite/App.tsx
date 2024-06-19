import { createSignal, type Component, createEffect, For, batch, on } from "solid-js"
import { Editor, addTextareaListener } from "../core"
import "../prism/languages/typescript"
import "../prism/languages/jsdoc"
import "../themes/github-dark.css"
import "./style.css"
import "../languages/clike"
import "../layout.css"
import "../scrollbar.css"
import "../extensions/folding/folding.css"
import "../extensions/copy-button/copy.css"
import "../extensions/search/search.css"
import { matchBrackets } from "../extensions/match-brackets"
import { highlightBracketPairs } from "../extensions/match-brackets/highlight"
import { indentGuides } from "../extensions/guides"
import { searchWidget } from "../extensions/search/widget"
import { highlightSelectionMatches } from "../extensions/search/selection"
import core from "../core?raw"
import { highlightMatchingTags, matchTags } from "../extensions/match-tags"
import { cursorPosition } from "../extensions/cursor"
import { defaultCommands, editHistory } from "../extensions/commands"
import { blockCommentFolding, markdownFolding, readOnlyCodeFolding } from "../extensions/folding"
import { copyButton } from "../extensions/copy-button"
import { Extension } from ".."
import { addTooltip } from "../tooltips"
import { languages } from "../prism"
import { loadTheme } from "../themes"
import { overscroll } from "../extensions/overscroll"

const tooltip: Extension = editor => {
	const { show, hide, element } = addTooltip(
		editor,
		<div class="tooltip">Cannot edit read-only editor.</div>,
		false,
	)

	addTextareaListener(
		editor,
		"beforeinput",
		() => {
			if (editor.props.readOnly) show()
		},
		true,
	)
	addTextareaListener(editor, "click", hide)
	createEffect(on(editor.selection, hide))
	return element
}

const themeStyle = document.querySelector("style")!

const App: Component = () => {
	let select!: HTMLSelectElement
	const [langs, setLangs] = createSignal(["typescript", "firestore-security-rules"])
	const [lang, setLang] = createSignal("typescript")
	const [value, setValue] = createSignal(core)
	const [readOnly, setReadOnly] = createSignal(false)

	const extensions = [
		matchBrackets(),
		searchWidget(),
		indentGuides(),
		highlightBracketPairs(),
		highlightSelectionMatches(),
		matchTags(),
		highlightMatchingTags(),
		cursorPosition(),
		defaultCommands(),
		editHistory(),
		tooltip,
		copyButton(),
		overscroll(),
	]

	const readExtensions = extensions.concat(
		readOnlyCodeFolding(blockCommentFolding, markdownFolding),
	)

	setTimeout(() => {
		import("../languages")
		import("../prism/languages").then(() => {
			setLangs(
				Object.keys(languages).filter(
					(name, i, keys) =>
						i > 3 && languages[name] != languages[keys[i - 1]] && !/[^i]doc|regex/.test(name),
				),
			)
			select.value = "typescript"
		})
	}, 500)

	return (
		<>
			<div>
				<label>
					Theme:
					<div class="select">
						<select
							onInput={e => {
								const theme = (e.target as HTMLSelectElement).value.toLowerCase().replace(/ /g, "-")
								loadTheme(theme).then(css => {
									themeStyle.textContent = css!
								})
							}}
						>
							<option>Atom One Dark</option>
							<option>Dracula</option>
							<option selected>Github Dark</option>
							<option>Github Dark Dimmed</option>
							<option>Github Light</option>
							<option>Night Owl</option>
							<option>Prism</option>
							<option>Prism Okaidia</option>
							<option>Prism Solarized Light</option>
							<option>Prism Tomorrow</option>
							<option>Prism Twilight</option>
							<option>VS Code Dark</option>
							<option>VS Code Light</option>
						</select>
					</div>
				</label>
				<label>
					Language:
					<div class="select">
						<select
							ref={select}
							onInput={() => {
								const lang = select.value
								import("./examples").then(mod => {
									batch(() => {
										setLang(lang)
										setValue(mod.default[lang] || core)
									})
								})
							}}
						>
							<For each={langs()}>{lang => <option>{lang}</option>}</For>
						</select>
					</div>
				</label>
				<label>
					<input type="checkbox" onInput={e => setReadOnly(e.target.checked)} />
					Read-only
				</label>
			</div>
			<Editor
				readOnly={readOnly()}
				language={lang()}
				value={value()}
				insertSpaces={false}
				extensions={readOnly() ? readExtensions : extensions}
			/>
		</>
	)
}

export default App
