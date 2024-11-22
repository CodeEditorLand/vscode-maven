// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Node } from "domhandler";
import * as vscode from "vscode";

import {
	getCurrentNode,
	getEnclosingTag,
	XmlTagName,
} from "../utils/lexerUtils";

class CodeActionProvider implements vscode.CodeActionProvider {
	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		_context: vscode.CodeActionContext,
		_token: vscode.CancellationToken,
	): vscode.Command[] | undefined {
		const documentText: string = document.getText();

		const cursorOffset: number = document.offsetAt(range.start);

		const currentNode: Node | undefined = getCurrentNode(
			documentText,
			cursorOffset,
		);

		if (
			currentNode === undefined ||
			currentNode.startIndex === null ||
			currentNode.endIndex === null
		) {
			return undefined;
		}

		const tagNode = getEnclosingTag(currentNode);

		if (tagNode?.tagName === XmlTagName.Dependencies) {
			const addDependencyCommand: vscode.Command = {
				command: "maven.project.addDependency",
				title: "Add a dependency from Maven Central Repository...",
				arguments: [
					{
						pomPath: document.uri.fsPath,
					},
				],
			};

			return [addDependencyCommand];
		}

		return undefined;
	}
}

export const codeActionProvider: CodeActionProvider = new CodeActionProvider();
