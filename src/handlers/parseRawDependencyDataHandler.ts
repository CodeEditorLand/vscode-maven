// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { Dependency } from "../explorer/model/Dependency";
import { MavenProject } from "../explorer/model/MavenProject";
import { IOmittedStatus } from "../explorer/model/OmittedStatus";
import { getDependencyTree } from "../handlers/showDependenciesHandler";

const DUPLICATE_INDICATOR: string = "omitted for duplicate";
const CONFLICT_INDICATOR: string = "omitted for conflict";

export async function parseRawDependencyDataHandler(project: MavenProject): Promise<Dependency[][]> {
    const dependencyTree: string | undefined = await getDependencyTree(project.pomPath);
    if (dependencyTree === undefined) {
        throw new Error("Failed to generate dependency tree.");
    }
    let treeContent: string = dependencyTree.slice(0, -1); // delete last "\n"
    treeContent = treeContent.replace(/\|/g, " ");
    treeContent = treeContent.replace(/\\/g, "+");
    treeContent = treeContent.replace(/\n/g, "\r\n");
    // handle the version switch in conflict
    // input = (groupId:artifactId:)(version1)(:scope (omitted for conflict): (version2))
    // output = (groupId:artifactId:)(version2)(:scope (omitted for conflict) with (version1))
    const re = /([\w.]+:[\w.-]+:)([\w.-]+)(:[\w/.(\s]+):\s([\w.-]+)\)/gm;
    treeContent = treeContent.replace(re, "$1$4$3 with $2)");
    project.fullText = treeContent;

    const indent: string = "   "; // three spaces
    const eol: string = "\r\n";
    const prefix: string = "+- ";
    return await parseTreeNodes(treeContent, eol, indent, prefix, project.pomPath);
}

async function parseTreeNodes(treecontent: string, eol: string, indent: string, prefix: string, projectPomPath: string): Promise<Dependency[][]> {
    const treeNodes: Dependency[] = [];
    const conflictNodes: Dependency[] = [];
    if (treecontent) {
        let curNode: Dependency;
        let preNode: Dependency;
        let parentNode: Dependency;
        let rootNode: Dependency;
        let curIndentCnt: number;
        let preIndentCnt: number;
        const lines: string[] = treecontent.split(eol).splice(1); // delete project name
        const toDependency = (line: string): Dependency => {
            let name: string = line.slice(curIndentCnt + prefix.length);
            const indexCut: number = name.indexOf("(");
            let supplement: string = "";
            if (indexCut !== -1) {
                supplement = name.substr(indexCut);
                name = name.substr(0, indexCut);
            }
            const [gid, aid, version, scope] = name.split(":");
            let effectiveVersion: string;
            let omittedStatus: IOmittedStatus;
            if (supplement.indexOf(CONFLICT_INDICATOR) !== -1) {
                const re = /\(omitted for conflict with ([\w.-]+)\)/gm;
                effectiveVersion = supplement.replace(re, "$1");
                omittedStatus = {status: "conflict", effectiveVersion: effectiveVersion, description: supplement};
            } else if (supplement.indexOf(DUPLICATE_INDICATOR) !== -1) {
                omittedStatus = {status: "duplicate", effectiveVersion: version, description: supplement};
            } else {
                omittedStatus = {status: "normal", effectiveVersion: version};
            }
            return new Dependency(gid, aid, version, scope, omittedStatus, projectPomPath);
        };
        lines.forEach(line => {
            curIndentCnt = line.indexOf(prefix);
            curNode = toDependency(line);
            let uri: vscode.Uri;
            let curFilePath: string;
            if (curIndentCnt === 0) {
                curNode.root = curNode;
                rootNode = curNode;
                parentNode = curNode;
                curFilePath = path.join(curNode.groupId, curNode.artifactId);
            } else {
                curNode.root = rootNode;
                if (curIndentCnt === preIndentCnt) {
                    parentNode.addChild(curNode);
                } else if (curIndentCnt > preIndentCnt) {
                    parentNode = preNode;
                    parentNode.addChild(curNode);
                } else {
                    const level: number = (preIndentCnt - curIndentCnt) / indent.length;
                    for (let i = level; i > 0; i -= 1) {
                        parentNode = <Dependency> parentNode.parent;
                    }
                    parentNode.addChild(curNode);
                }
                const parentFilePath: string = parentNode.uri.path;
                curFilePath = path.join(parentFilePath, path.join(curNode.groupId, curNode.artifactId));
            }
            // set uri
            uri = vscode.Uri.file(curFilePath);
            uri = uri.with({authority: projectPomPath}); // distinguish dependency in multi-module project
            if (curNode.omittedStatus.status === "conflict") {
                curNode.uri = uri.with({query: "hasConflict"});
                // find all parent and set hasConflict upforward
                let tmpNode = curNode;
                while (tmpNode.parent !== undefined) {
                    const parent = <Dependency> tmpNode.parent;
                    if (parent.uri.query !== "hasConflict") {
                        parent.uri = uri.with({query: "hasConflict"});
                        tmpNode = parent;
                    } else {
                        break;
                    }
                }
            } else {
                curNode.uri = uri;
            }
            if (curNode.omittedStatus.status === "conflict") {
                conflictNodes.push(curNode);
            }
            if (curIndentCnt === 0) {
                treeNodes.push(rootNode);
            }
            preIndentCnt = curIndentCnt;
            preNode = curNode;
        });
    }
    return [treeNodes, conflictNodes];
}