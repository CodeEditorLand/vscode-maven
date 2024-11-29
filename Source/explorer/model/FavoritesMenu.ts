// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

import { Settings } from "../../Settings";
import { FavoriteCommand } from "./FavoriteCommand";
import { ITreeItem } from "./ITreeItem";
import { MavenProject } from "./MavenProject";
import { ProjectMenu } from "./Menu";

export class FavoritesMenu extends ProjectMenu implements ITreeItem {
	constructor(project: MavenProject) {
		super(project);

		this.name = "Favorites";
	}

	public getContextValue(): string {
		return "maven:favoritesMenu";
	}

	public async getChildren(): Promise<FavoriteCommand[] | undefined> {
		return Settings.Terminal.favorites(this.project);
	}

	public getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const treeItem: vscode.TreeItem = new vscode.TreeItem(
			this.name,
			vscode.TreeItemCollapsibleState.Collapsed,
		);

		treeItem.iconPath = new vscode.ThemeIcon("star-empty");

		return treeItem;
	}
}
