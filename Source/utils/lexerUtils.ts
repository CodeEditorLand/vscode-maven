// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
import {
	Document,
	Element,
	isTag,
	isText,
	Node,
	NodeWithChildren,
} from "domhandler";
import * as hp from "htmlparser2";

export type ElementNode = Node;

export enum XmlTagName {
	GroupId = "groupId",
	ArtifactId = "artifactId",
	Version = "version",
	Dependencies = "dependencies",
	DependencyManagement = "dependencyManagement",
	Exclusions = "exclusions",
	Plugins = "plugins",
	Plugin = "plugin",
	Project = "project",
	Dependency = "dependency",
	Properties = "properties",
	Packaging = "packaging",
	Module = "module",
	Modules = "modules",
	Parent = "parent",
	RelativePath = "relativePath",
}

export function parseDocument(text: string): Document {
	return hp.parseDocument(text, {
		withEndIndices: true,
		withStartIndices: true,
		lowerCaseTags: false,
		xmlMode: true,
	});
}

export function getChildrenByTags(
	parentElement: NodeWithChildren,
	tags: string[],
): Element[] {
	const ret: Element[] = [];

	for (const child of parentElement.children) {
		if (isTag(child) && tags.includes(child.tagName)) {
			ret.push(child);
		}
	}

	return ret;
}

/**
 * This requires the document to be parsed with withStartIndices and withEndIndices options.
 *
 * @param xmlDocument the root document
 * @param rawText the text of the document
 * @returns the indent size and character
 */
export function detectDocumentIndent(
	xmlDocument: Document,
	rawText: string,
): any {
	const projectNodes = getChildrenByTags(xmlDocument, [XmlTagName.Project]);

	if (!projectNodes.length) {
		return;
	}

	const firstChildElement = projectNodes[0].children.find((node) =>
		isTag(node),
	);

	if (!firstChildElement || firstChildElement.startIndex === null) {
		return;
	}

	let indent = 0;

	let indentChar = " ";

	let startOffset = firstChildElement.startIndex;

	while (--startOffset > 0 && rawText.charAt(startOffset) != "\n") {
		if (rawText.charAt(startOffset) == "\t") {
			indentChar = "\t";
		} else {
			indentChar = " ";
		}

		indent++;
	}

	return {
		indent,
		indentChar,
	};
}

export function getNodesByTag(text: string, tag: string): Element[] {
	const document: Document = hp.parseDocument(text, {
		withEndIndices: true,
		withStartIndices: true,
		lowerCaseTags: false,
		xmlMode: true,
	});

	const ret: Element[] = [];

	dfs(document, (node) => isTag(node) && node.tagName === tag, ret);

	return ret;
}

export function getCurrentNode(text: string, offset: number): Node | undefined {
	const document: Document = hp.parseDocument(text, {
		withEndIndices: true,
		withStartIndices: true,
		lowerCaseTags: false,
		xmlMode: true,
	});

	const ret: Node[] = [];

	dfs(
		document,
		(node) =>
			node.startIndex !== null &&
			node.startIndex <= offset &&
			node.endIndex !== null &&
			offset <= node.endIndex,
		ret,
		true,
	);

	return ret?.[ret.length - 1];
}

export function getNodePath(node: Node) {
	const parents = [];

	let cur: Node | null = node;

	while (cur) {
		if (isTag(cur)) {
			parents.unshift(cur.tagName);
		}

		cur = cur.parent;
	}

	return parents.join(".");
}

export function getTextFromNode(
	node: Node | undefined | null,
	fallbackValue = "",
) {
	return node && isText(node) ? node.data : fallbackValue;
}

export function getInnerStartIndex(node: Element) {
	if (node.startIndex !== null) {
		return node.startIndex + node.tagName.length + "<>".length;
	} else {
		return -1;
	}
}

export function getInnerEndIndex(node: Element) {
	if (node.endIndex !== null) {
		return node.endIndex - node.tagName.length - "</>".length + 1;
	} else {
		return -1;
	}
}

export function getEnclosingTag(node: Node): Element | null {
	let currentNode: Node | null = node;

	while (currentNode) {
		if (isTag(currentNode)) {
			return currentNode;
		}

		currentNode = currentNode.parent;
	}

	return null;
}

function dfs(
	node: Node,
	pred: (arg: Node) => boolean,
	result: Node[],
	includeAll?: boolean,
) {
	if (pred(node)) {
		result.push(node);

		if (!includeAll) {
			return;
		}
	}

	if (node instanceof NodeWithChildren) {
		for (const child of (node as NodeWithChildren).children) {
			dfs(child, pred, result, includeAll);
		}
	}
}
