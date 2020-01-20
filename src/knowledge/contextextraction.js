// This is a standalone implementation of ContextExtraction with Jquery functions replaced with non jquery implementation
// based on bingWidget\private\WidgetAnswer\BingWidget\WebApp\Scripts\bootstrap\knowledge\contextextraction.ts
function ContextExtraction() {
    this.leftTextNodes = [];
    this.rightTextNodes = [];
    this.leftCharCount = 0;
    this.rightCharCount = 0;
}

ContextExtraction.prototype.maxContextTextSize = 3000;
ContextExtraction.prototype.blacklistedNodes = { 'SCRIPT': 1, 'STYLE': 1, 'IFRAME': 1, 'OBJECT': 1, 'EMBED': 1, 'AUDIO': 1, 'VIDEO': 1, 'CANVAS': 1, 'FRAME': 1, 'FRAMESET': 1, 'NOSCRIPT': 1, 'TEXTAREA': 1, '#comment': 1 };
ContextExtraction.prototype.documentTopNodes = { 'BODY': 1, 'HTML': 1 };

ContextExtraction.prototype.getSelectionInfo = function (element) {
    var selectionInfo = null;
    var selectionText = null;
    var range = null;
    if (element){
        range = document.createRange();
        range.selectNodeContents(element);
        selectionText = range.toString().trim();
    }
    else {
        var selectionObj = window.getSelection();
        selectionText = selectionObj.toString().trim();
        range = selectionObj.getRangeAt(0);
    }

    if(selectionText && range){
        var selectionParent = range.commonAncestorContainer;
        if (selectionParent.nodeType != 1) {
            selectionParent = selectionParent.parentNode;
        };

        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(selectionParent);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;

        selectionInfo = {};
        selectionInfo.selectedText = selectionText;
        selectionInfo.selectionParent = selectionParent;
        selectionInfo.selectionStartingOffset = caretOffset - selectionText.length;
    }
    return selectionInfo;
};

ContextExtraction.prototype.extractSelectionContext = function (element) {
    var context = null;
    var selectioninfo = this.getSelectionInfo(element);
    if (selectioninfo) {
        var selectedParentText = selectioninfo.selectionParent.textContent;
        var parentTextInfo = this.compactParentTextAndGetNewIndex(selectedParentText, selectioninfo.selectedText, selectioninfo.selectionStartingOffset);
        if (parentTextInfo && parentTextInfo.compactedText.length <= this.maxContextTextSize) {
            selectedParentText = parentTextInfo.compactedText;
            var extraTextRequired = this.maxContextTextSize - selectedParentText.length;
            var extraContentLengthRequiredEachSide = extraTextRequired / 2;
            var leftContext = this.getLeftContextText(selectioninfo.selectionParent, extraContentLengthRequiredEachSide);
            var rightContext = this.getRightContextText(selectioninfo.selectionParent, extraContentLengthRequiredEachSide);
            context = {};
            context.selectedText = selectioninfo.selectedText;
            context.fullContext = leftContext + " " + selectedParentText + " " + rightContext;
            context.startingIndex = leftContext.length + 1 + parentTextInfo.selectionStartingOffset;
        }
    }
    return context;
};
ContextExtraction.prototype.getLeftContextText = function (node, contentExtractionLength) {
    this.leftTextNodes = [];
    this.leftCharCount = 0;
    this.leftSubtreeWalk(node, contentExtractionLength);
    var leftContext = this.leftTextNodes.reverse().join(" ");
    if (leftContext.length <= contentExtractionLength) {
        return leftContext;
    }
    return leftContext.substr(leftContext.length - contentExtractionLength);
};
ContextExtraction.prototype.getRightContextText = function (node, contentExtractionLength) {
    this.rightTextNodes = [];
    this.rightCharCount = 0;
    this.rightSubtreeWalk(node, contentExtractionLength);
    var rightContext = this.rightTextNodes.join(" ");
    if (rightContext.length <= contentExtractionLength) {
        return rightContext;
    }
    return rightContext.substr(0, contentExtractionLength);
};
ContextExtraction.prototype.leftSubtreeWalk = function (node, contentLength) {
    if (!node || this.leftCharCount > contentLength) {
        return;
    }
    var prevSiblings = this.getLeftSiblings(node);
    for (var i = 0; i < prevSiblings.length; i++) {
        var siblingNode = prevSiblings[i];
        if (this.leftCharCount > contentLength) {
            break;
        }
        if (this.isBlacklistedTag(siblingNode.nodeName)) {
            continue;
        }
        if (siblingNode.childNodes.length == 0) {
            var cleanedText = this.cleanText(siblingNode.textContent);
            if (cleanedText) {
                this.leftTextNodes.push(cleanedText);
                this.leftCharCount += cleanedText.length;
            }
        }
        else {
            this.reversePostOrder(siblingNode, contentLength);
        }
    }
    ;
    if (!this.isDocumentTopNode(node.tagName) && !this.isDocumentTopNode(node.parentNode.tagName)) {
        this.leftSubtreeWalk(node.parentNode, contentLength);
    }
};
ContextExtraction.prototype.reversePostOrder = function (node, contentLength) {
    if (!node || this.leftCharCount > contentLength) {
        return;
    }
    node = node.lastChild;
    var lastReadNode = null;
    while (node) {
        if (node.nodeType == 3) {
            this.leftCharCount += this.pushCleanedTextNode(node, this.leftTextNodes);
        }
        else {
            if (!this.isBlacklistedTag(node.tagName)) {
                this.reversePostOrder(node, contentLength);
            }
            lastReadNode = node;
        }
        node = node.previousSibling;
    }
    this.leftCharCount += this.pushCleanedTextNode(lastReadNode, this.leftTextNodes);
};
ContextExtraction.prototype.rightSubtreeWalk = function (node, contentLength) {
    if (!node || this.rightCharCount > contentLength) {
        return;
    }
    var nextSiblings = this.getRightSiblings(node);
    for (var i = 0; i < nextSiblings.length; i++) {
        var siblingNode = nextSiblings[i];
        if (this.rightCharCount > contentLength) {
            break;
        }
        if (this.isBlacklistedTag(siblingNode.nodeName)) {
            continue;
        }
        if (siblingNode.childNodes.length == 0) {
            var cleanedText = this.cleanText(siblingNode.textContent);
            if (cleanedText) {
                this.rightTextNodes.push(cleanedText);
                this.rightCharCount += cleanedText.length;
            }
        }
        else {
            this.forwardPreOrder(siblingNode, contentLength);
        }
    }
    if (!this.isDocumentTopNode(node.tagName) && !this.isDocumentTopNode(node.parentNode.tagName)) {
        this.rightSubtreeWalk(node.parentNode, contentLength);
    }
};
ContextExtraction.prototype.forwardPreOrder = function (node, contentLength) {
    this.rightCharCount += this.pushCleanedTextNode(node, this.rightTextNodes);
    if (this.rightCharCount > contentLength) {
        return;
    }
    node = node.firstChild;
    while (node) {
        if (!this.isBlacklistedTag(node.tagName)) {
            this.forwardPreOrder(node, contentLength);
        }
        node = node.nextSibling;
    }
};
ContextExtraction.prototype.isBlacklistedTag = function (tagName) {
    return (tagName && this.blacklistedNodes[tagName] == 1);
};
ContextExtraction.prototype.isDocumentTopNode = function (tagName) {
    return (tagName && this.documentTopNodes[tagName] == 1);
};
ContextExtraction.prototype.cleanText = function (text) {
    var cleanRegex = /[\r\n\t\f\v<>]/g;
    var contentRegexSpace = /  +/g;
    var contentRegexTrim = /^\s+|\s+$/g;
    var result = text.replace(cleanRegex, ' ').replace(contentRegexSpace, ' ').replace(contentRegexTrim, '');
    if (result.length == 0) {
        return null;
    } else if (result === ".column"){
        console.log("problem!");
    }
    return result;
};
ContextExtraction.prototype.pushCleanedTextNode = function (node, array) {
    if (node && node.nodeType == 3 && node.nodeValue) {
        var cleanedText = this.cleanText(node.nodeValue);
        if (cleanedText) {
            array.push(cleanedText);
            return cleanedText.length;
        }
    }
    return 0;
};
ContextExtraction.prototype.getLeftSiblings = function (selectedNode) {
    var _this = this;
    var leftNodes = [];
    var elements = selectedNode.parentNode.childNodes;
    for(var i=0; i < elements.length; i++)
    {
        var node = elements[i]
        if ((_this.isSameNode(node, selectedNode))) {
            break;
        }  
        leftNodes.push(node);   
    }
    return leftNodes.reverse();
};
ContextExtraction.prototype.getRightSiblings = function (selectedNode) {
    var _this = this;
    var left = true;
    var rightNodes = [];
    var elements = selectedNode.parentNode.childNodes;
    for(var i=0; i < elements.length; i++)
    {
        var node = elements[i]
        if (!left) {
            rightNodes.push(node);
        }
        else if ((_this.isSameNode(node, selectedNode)) && (left)) {
            left = false;
        }
    }
    return rightNodes;
};
ContextExtraction.prototype.isSameNode = function (node1, node2) {
    return (node1 === node2);
};
ContextExtraction.prototype.compactParentTextAndGetNewIndex = function (parentText, selectedText, selectionStartingOffset) {
    if (!parentText || !selectedText) {
        return null;
    }
    var textBeforeSelection = parentText.substring(0, selectionStartingOffset);
    var textAfterSelection = parentText.substring(selectionStartingOffset + selectedText.length);
    var cleanTextBeforeSelection = this.cleanText(textBeforeSelection) || "";
    var cleanTextAfterSelection = this.cleanText(textAfterSelection) || "";
    var maxAfterBeforeSelectionLength = (this.maxContextTextSize - selectedText.length - 2) / 2;
    if (cleanTextBeforeSelection) {
        if (cleanTextBeforeSelection.length > maxAfterBeforeSelectionLength) {
            cleanTextBeforeSelection = cleanTextBeforeSelection.slice(-maxAfterBeforeSelectionLength);
        }
        cleanTextBeforeSelection += " ";
    }
    if (cleanTextAfterSelection) {
        if (cleanTextAfterSelection.length > maxAfterBeforeSelectionLength) {
            cleanTextAfterSelection = cleanTextAfterSelection.slice(0, maxAfterBeforeSelectionLength);
        }
        cleanTextAfterSelection = " " + cleanTextAfterSelection;
    }
    var compactText = cleanTextBeforeSelection + selectedText + cleanTextAfterSelection;
    return {
        compactedText: compactText,
        selectionStartingOffset: cleanTextBeforeSelection.length
    };
};