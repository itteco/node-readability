/*jslint undef: true, nomen: true, eqeqeq: true, plusplus: true, newcap: true, immed: true, browser: true, devel: true, passfail: false */
/*global window: false, readConvertLinksToFootnotes: false, readStyle: false, readSize: false, readMargin: false, Typekit: false, ActiveXObject: false */
var Buffer = require('buffer').Buffer;
var Iconv  = require('iconv').Iconv;
var urllib = require('url');
var dbg = (typeof console !== 'undefined') ? function(/*args*/) {
    if (readability.debugging) {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(this, ['Readability: '].concat(args));
    }
} : function() {};

/*
 * Readability. An Arc90 Lab Experiment. 
 * Website: http://lab.arc90.com/experiments/readability
 * Source:  http://code.google.com/p/arc90labs-readability
 *
 * "Readability" is a trademark of Arc90 Inc and may not be used without explicit permission. 
 *
 * Copyright (c) 2010 Arc90 Inc
 * Readability is licensed under the Apache License, Version 2.0.
**/
var readability = {
    version:                '1.7.1',
    debugging:              true,
    emailSrc:               'http://lab.arc90.com/experiments/readability/email.php',
    iframeLoads:             0,
    convertLinksToFootnotes: false,
    reversePageScroll:       false, /* If they hold shift and hit space, scroll up */
    frameHack:               false, /**
                                      * The frame hack is to workaround a firefox bug where if you
                                      * pull content out of a frame and stick it into the parent element, the scrollbar won't appear.
                                      * So we fake a scrollbar in the wrapping div.
                                     **/
    biggestFrame:            false,
    stopOnNoContent:         false, //return failure immeaditely, if no article was found instead of displaying workarounds
    returnContentOnly:       false,
    bodyCache:               null,   /* Cache the body HTML in case we need to re-use it later */
    flags:                   0x1 | 0x2 | 0x4,   /* Start with all flags set. */

    /* constants */
    FLAG_STRIP_UNLIKELYS:     0x1,
    FLAG_WEIGHT_CLASSES:      0x2,
    FLAG_CLEAN_CONDITIONALLY: 0x4,

    maxPages:    30, /* The maximum number of pages to loop through before we call it quits and just show a link. */
    parsedPages: {}, /* The list of pages we've parsed in this call of readability, for autopaging. As a key store for easier searching. */
    pageETags:   {}, /* A list of the ETag headers of pages we've parsed, in case they happen to match, we'll know it's a duplicate. */
    success: function (html) {
        
    },
    failure: function () {
        
    },
    /**
     * All of the regular expressions in use within readability.
     * Defined up here so we don't instantiate them repeatedly in loops.
     **/
    regexps: {
        unlikelyCandidates:    /combx|comment|community|disqus|extra|foot|header|menu|remark|rss|shoutbox|sidebar|sponsor|ad-break|agegate|pagination|pager|popup|tweet|twitter/i,
        okMaybeItsACandidate:  /and|article|body|column|main|shadow/i,
        positive:              /article|body|content|entry|hentry|main|page|pagination|post|text|blog|story/i,
        negative:              /combx|comment|com-|contact|foot|footer|footnote|masthead|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget/i,
        extraneous:            /print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single/i,
        divToPElements:        /<(a|blockquote|dl|div|img|ol|p|pre|table|ul|iframe|embed)/i,
        replaceBrs:            /(<br[^>]*>[ \n\r\t]*){2,}/gi,
        replaceFonts:          /<(\/?)font[^>]*>/gi,
        trim:                  /^\s+|\s+$/g,
        normalize:             /\s{2,}/g,
        killBreaks:            /(<br\s*\/?>(\s|&nbsp;?)*){1,}/g,
        videos:                /http:\/\/(www\.)?(youtube|vimeo)\.com/i,
        skipFootnoteLink:      /^\s*(\[?[a-z0-9]{1,2}\]?|^|edit|citation needed)\s*$/i,
        nextLink:              /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i, // Match: next, continue, >, >>, » but not >|, »| as those usually mean last.
        prevLink:              /(prev|earl|old|new|<|«)/i
    },

    embedAllowedRegexps: [
        /https?:\/\/(?:[a-z0-9\-]+\.)?(?:(?:dipdive|youtube|vimeo|viddler|dailymotion|flickr|viddy|spreecast|issuu|telly|trutv|socialcam|ted|rdio|nymag|youku|qik|speakerdeck|mixcloud|bravotv|animoto|revision3|spotify|bandcamp|soundcloud|hulu|yahoo|keek)\.com|(?:slideshare)\.net|(?:wordpress|justin|blip)\.tv|(?:vid)\.ly)/i,
        /https?:\/\/(?:[a-z0-9\-]+\.)?facebook\.com(\/(?!plugins)\w+)+/i
    ],

    /**
     * Runs readability.
     * 
     * Workflow:
     *  1. Prep the document by removing script tags, css, etc.
     *  2. Build readability's DOM tree.
     *  3. Grab the article content from the current dom tree.
     *  4. Replace the current DOM tree with the new one.
     *  5. Read peacefully.
     *
     * @return void
     **/
    init: function() {
        /* Before we do anything, remove all scripts that are not readability. */
        window.onload = window.onunload = function() {};

        readability.removeScripts(document);

        if(document.body && !readability.bodyCache) {
            readability.bodyCache = document.body.innerHTML;

        }
        /* Make sure this document is added to the list of parsed pages first, so we don't double up on the first page */
        readability.parsedPages[window.location.href.replace(/\/$/, '')] = true;

        readability.prepDocument();

        var articleTitle = readability.getArticleTitle();
        var articleContent = readability.grabArticle();

        if (!articleContent) {
            return readability.failure();
        }

        document.title = articleTitle;
        document.dir = readability.getSuggestedDirection(articleTitle);

        if (readability.removeClassNames) removeClassNames(articleContent);

        if (readability.straightifyDocument){
            articleContent = straightifyDocument(articleContent);
        }

        document.body.innerHTML = "";
        document.body.insertBefore(articleContent, document.body.firstChild);
        document.body.removeAttribute('style');

        if (readability.returnContentOnly){
            var contentContainer = document.getElementById('s-article-page-iframely');
            if (null !== contentContainer) {
                return readability.success(contentContainer.innerHTML);
            } else {
                return readability.success(articleContent.innerHTML);
            }
        }
        /* Clear the old HTML, insert the new content. */

        return readability.success(document.body.innerHTML);
    },

    /**
     * retuns the suggested direction of the string
     *
     * @return "rtl" || "ltr"
     **/
    getSuggestedDirection: function(text) {
        function sanitizeText() {
            return text.replace(/@\w+/, "");
        }
        
        function countMatches(match) {
            var matches = text.match(new RegExp(match, "g"));
            return matches !== null ? matches.length : 0; 
        }
        
        function isRTL() {            
            var count_heb =  countMatches("[\\u05B0-\\u05F4\\uFB1D-\\uFBF4]");
            var count_arb =  countMatches("[\\u060C-\\u06FE\\uFB50-\\uFEFC]");

            // if 20% of chars are Hebrew or Arbic then direction is rtl
            return  (count_heb + count_arb) * 100 / text.length > 20;
        }

        text  = sanitizeText(text);
        return isRTL() ? "rtl" : "ltr";
    },

    
    /**
     * Get the article title as an H1.
     *
     * @return void
     **/
    getArticleTitle: function () {
        var curTitle = "",
            origTitle = "";

        try {
            curTitle = origTitle = document.title;
            
            if(typeof curTitle !== "string") { /* If they had an element with id "title" in their HTML */
                curTitle = origTitle = readability.getInnerText(document.getElementsByTagName('title')[0]);             
            }
        }
        catch(e) {}
        
        if(curTitle.match(/ [\|\-] /))
        {
            curTitle = origTitle.replace(/(.*)[\|\-] .*/gi,'$1');
            
            if(curTitle.split(' ').length < 3) {
                curTitle = origTitle.replace(/[^\|\-]*[\|\-](.*)/gi,'$1');
            }
        }
        else if(curTitle.indexOf(': ') !== -1)
        {
            curTitle = origTitle.replace(/.*:(.*)/gi, '$1');

            if(curTitle.split(' ').length < 3) {
                curTitle = origTitle.replace(/[^:]*[:](.*)/gi,'$1');
            }
        }
        else if(curTitle.length > 150 || curTitle.length < 15)
        {
            var hOnes = document.getElementsByTagName('h1');
            if(hOnes.length === 1)
            {
                curTitle = readability.getInnerText(hOnes[0]);
            }
        }

        curTitle = curTitle.replace( readability.regexps.trim, "" );

        if(curTitle.split(' ').length <= 4) {
            curTitle = origTitle;
        }
        
        return curTitle;
    },

    /**
     * Prepare the HTML document for readability to scrape it.
     * This includes things like stripping javascript, CSS, and handling terrible markup.
     * 
     * @return void
     **/
    prepDocument: function () {
        /**
         * In some cases a body element can't be found (if the HTML is totally hosed for example)
         * so we create a new body node and append it to the document.
         */
        if(document.body === null)
        {
            var body = document.createElement("body");
            try {
                document.body = body;       
            }
            catch(e) {
                document.documentElement.appendChild(body);
                dbg(e);
            }
        }

        document.body.id = "readabilityBody";

        var frames = document.getElementsByTagName('frame');
        if(frames.length > 0)
        {
            var bestFrame = null;
            var bestFrameSize = 0;    /* The frame to try to run readability upon. Must be on same domain. */
            var biggestFrameSize = 0; /* Used for the error message. Can be on any domain. */
            for(var frameIndex = 0; frameIndex < frames.length; frameIndex+=1)
            {
                var frameSize = frames[frameIndex].offsetWidth + frames[frameIndex].offsetHeight;
                var canAccessFrame = false;
                try {
                    var frameBody = frames[frameIndex].contentWindow.document.body;
                    canAccessFrame = true;
                }
                catch(eFrames) {
                    dbg(eFrames);
                }

                if(frameSize > biggestFrameSize) {
                    biggestFrameSize         = frameSize;
                    readability.biggestFrame = frames[frameIndex];
                }
                
                if(canAccessFrame && frameSize > bestFrameSize)
                {
                    readability.frameHack = true;
    
                    bestFrame = frames[frameIndex];
                    bestFrameSize = frameSize;
                }
            }

            if(bestFrame)
            {
                var newBody = document.createElement('body');
                newBody.innerHTML = bestFrame.contentWindow.document.body.innerHTML;
                newBody.style.overflow = 'scroll';
                document.body = newBody;
                
                var frameset = document.getElementsByTagName('frameset')[0];
                if(frameset) {
                    frameset.parentNode.removeChild(frameset); }
            }
        }
    },

    /**
     * Prepare the article node for display. Clean out any inline styles,
     * iframes, forms, strip extraneous <p> tags, etc.
     *
     * @param Element
     * @return void
     **/
    prepArticle: function (articleContent) {
        readability.cleanStyles(articleContent);
        readability.killBreaks(articleContent);

        /* Clean out junk from the article content */
        readability.clean(articleContent, "object");
        readability.clean(articleContent, "embed");
        readability.clean(articleContent, "iframe");
        readability.cleanConditionally(articleContent, "form");
        readability.clean(articleContent, "h1");

        /**
         * If there is only one h2, they are probably using it
         * as a header and not a subheader, so remove it since we already have a header.
        ***/
        if(articleContent.getElementsByTagName('h2').length === 1) {
            readability.clean(articleContent, "h2");
        }

        readability.cleanHeaders(articleContent);

        /* Do these last as the previous stuff may have removed junk that will affect these */
        readability.cleanConditionally(articleContent, "table");
        readability.cleanConditionally(articleContent, "ul");
        readability.cleanConditionally(articleContent, "div");

        readability.fixURIs(articleContent, "img", "src");
        readability.fixURIs(articleContent, "source", "src");
        readability.fixURIs(articleContent, "video", "src");
        readability.fixURIs(articleContent, "audio", "src");
        readability.fixURIs(articleContent, "a", "href");

timed(function() {
        /* Remove extra paragraphs */
        //arrix
        function WalkChildrenElements(node, func) {
            function walk(cur) {
                var children = cur.children, i, len, e;
                for (i = 0, len = children.length; i < len; i++) {
                    e = children[i];
                    if (e.nodeType == 1) {
                        func(e);
                        walk(e);
                    }
                }
            }
            walk(node);
        }

        var articleParagraphs = articleContent.getElementsByTagName('p');
        for(var i = articleParagraphs.length-1; i >= 0; i-=1) {
            var imgCount    = 0; //articleParagraphs[i].getElementsByTagName('img').length;
            var embedCount  = 0; // articleParagraphs[i].getElementsByTagName('embed').length;
            var objectCount = 0; // articleParagraphs[i].getElementsByTagName('object').length;
            var iframeCount = 0; // articleParagraphs[i].getElementsByTagName('object').length;

            //arrix
            WalkChildrenElements(articleParagraphs[i], function(cur) {
                switch (cur.tagName) {
                    case 'IMG':
                        imgCount++;
                        break;
                    case 'IFRAME':
                        iframeCount++;
                        break;
                    case 'EMBED':
                        embedCount++;
                        break;
                    case 'OBJECT':
                        objectCount++;
                        break;
                }
            
            });

            if(imgCount === 0 && embedCount === 0 && objectCount === 0 && iframeCount === 0 && readability.getInnerText(articleParagraphs[i], false) === '') {
                articleParagraphs[i].parentNode.removeChild(articleParagraphs[i]);
            }
        }
}, "prepArticle Remove extra paragraphs");

timed(function() {
        try {
            articleContent.innerHTML = articleContent.innerHTML.replace(/<br[^>]*>\s*<p/gi, '<p');      
        }
        catch (e) {
            dbg("Cleaning innerHTML of breaks failed. This is an IE strict-block-elements bug. Ignoring.: " + e);
        }
}, "prepArticle innerHTML replacement");
    },
    
    /**
     * Initialize a node with the readability object. Also checks the
     * className/id for special names to add to its score.
     *
     * @param Element
     * @return void
    **/
    initializeNode: function (node) {
        node.readability = {"contentScore": 0};         

        switch(node.tagName) {
            case 'ARTICLE':
            case 'DIV':
                node.readability.contentScore += 5;
                break;

            case 'PRE':
            case 'TD':
            case 'BLOCKQUOTE':
                node.readability.contentScore += 3;
                break;

            case 'VIDEO':
            case 'AUDIO':
                node.readability.contentScore += 1;
                break;

            case 'ADDRESS':
            case 'OL':
            case 'UL':
            case 'DL':
            case 'DD':
            case 'DT':
            case 'LI':
            case 'FORM':
                node.readability.contentScore -= 3;
                break;

            case 'H1':
            case 'H2':
            case 'H3':
            case 'H4':
            case 'H5':
            case 'H6':
            case 'TH':
                node.readability.contentScore -= 5;
                break;
        }
       
        node.readability.contentScore += readability.getClassWeight(node);
    },
    
    /***
     * grabArticle - Using a variety of metrics (content score, classname, element types), find the content that is
     *               most likely to be the stuff a user wants to read. Then return it wrapped up in a div.
     *
     * @param page a document to run upon. Needs to be a full document, complete with body.
     * @return Element
    **/
    grabArticle: function (page) {
        var stripUnlikelyCandidates = readability.flagIsActive(readability.FLAG_STRIP_UNLIKELYS),
            isPaging = (page !== null) ? true: false;

        page = page ? page : document.body;

        var pageCacheHtml = page.innerHTML;

        /**
         * First, node prepping. Trash nodes that look cruddy (like ones with the class name "comment", etc), and turn divs
         * into P tags where they have been used inappropriately (as in, where they contain no other block level elements.)
         *
         * Note: Assignment from index for performance. See http://www.peachpit.com/articles/article.aspx?p=31567&seqNum=5
         * TODO: Shouldn't this be a reverse traversal?
        **/
        var nodesToScore = [];
        function nodePrepping(node) {
            /* Remove unlikely candidates */
            if (stripUnlikelyCandidates) {
                var unlikelyMatchString = node.className + node.id;
                if (
                    (
                        unlikelyMatchString.search(readability.regexps.unlikelyCandidates) !== -1 &&
                        unlikelyMatchString.search(readability.regexps.okMaybeItsACandidate) === -1 &&
                        node.tagName !== "BODY"
                    )
                )
                {
                    dbg("Removing unlikely candidate - " + unlikelyMatchString);
                    node.parentNode.removeChild(node);
                    return null;
                }               
            }

            if (node.tagName === "P" || node.tagName === "TD" || node.tagName === "PRE") {
                nodesToScore[nodesToScore.length] = node;
            }

            /* Turn all divs that don't have children block level elements into p's */
            if (node.tagName === "DIV") {
                if (node.innerHTML.search(readability.regexps.divToPElements) === -1) {
                    var newNode = document.createElement('p');
                    try {
                        newNode.innerHTML = node.innerHTML;             
                        node.parentNode.replaceChild(newNode, node);

                        nodesToScore[nodesToScore.length] = node;

                        newNode.oneMoreTime = true;
                        return newNode;
                    }
                    catch(e) {
                        dbg("Could not alter div to p, probably an IE restriction, reverting back to div.: " + e);
                    }
                }/*
                else
                {
                    for(var i = 0, il = node.childNodes.length; i < il; i+=1) {
                        var childNode = node.childNodes[i];
                        if(childNode.nodeType === 3) { // Node.TEXT_NODE
                            var p = document.createElement('p');
                            p.innerHTML = childNode.nodeValue;
                            p.style.display = 'inline';
                            p.className = 'readability-styled';
                            childNode.parentNode.replaceChild(p, childNode);
                        }
                    }
                }*/
            }
            return node;
        }

        timed(function() {
            LiveTagWalker(page, '*', nodePrepping);
        }, 'grabArticle nodePrepping');

        /**
         * Loop through all paragraphs, and assign a score to them based on how content-y they look.
         * Then add their score to their parent node.
         *
         * A score is determined by things like number of commas, class names, etc. Maybe eventually link density.
        **/
        var candidates = [];
timed(function() {
        for (var pt=0; pt < nodesToScore.length; pt+=1) {
            var parentNode      = nodesToScore[pt].parentNode;
            var grandParentNode = parentNode ? parentNode.parentNode : null;
            var innerText       = readability.getInnerText(nodesToScore[pt]);

            if(!parentNode || typeof(parentNode.tagName) === 'undefined') {
                continue;
            }

            /* If this paragraph is less than 25 characters, don't even count it. */
            if(innerText.length < 25) {
                continue; }

            /* Initialize readability data for the parent. */
            if(typeof parentNode.readability === 'undefined') {
                readability.initializeNode(parentNode);
                candidates.push(parentNode);
            }

            /* Initialize readability data for the grandparent. */
            if(grandParentNode && typeof(grandParentNode.readability) === 'undefined' && typeof(grandParentNode.tagName) !== 'undefined') {
                readability.initializeNode(grandParentNode);
                candidates.push(grandParentNode);
            }

            var contentScore = 0;

            /* Add a point for the paragraph itself as a base. */
            contentScore+=1;

            /* Add points for any commas within this paragraph */
            contentScore += innerText.split(readability.reComma).length; //arrix
            
            /* For every 100 characters in this paragraph, add another point. Up to 3 points. */
            contentScore += Math.min(Math.floor(innerText.length / 100), 3);
            
            /* Add the score to the parent. The grandparent gets half. */
            parentNode.readability.contentScore += contentScore;

            if(grandParentNode) {
                grandParentNode.readability.contentScore += contentScore/2;             
            }
        }

}, 'grabArticle calculate scores');

        /**
         * After we've calculated scores, loop through all of the possible candidate nodes we found
         * and find the one with the highest score.
        **/
        var topCandidate = null;
timed(function() {
        for(var c=0, cl=candidates.length; c < cl; c+=1)
        {
            /**
             * Scale the final candidates score based on link density. Good content should have a
             * relatively small link density (5% or less) and be mostly unaffected by this operation.
            **/
            candidates[c].readability.contentScore = candidates[c].readability.contentScore * (1-readability.getLinkDensity(candidates[c]));

            dbg('Candidate: ' + candidates[c] + " (" + candidates[c].className + ":" + candidates[c].id + ") with score " + candidates[c].readability.contentScore);

            if(!topCandidate || candidates[c].readability.contentScore > topCandidate.readability.contentScore) {
                topCandidate = candidates[c]; }
        }

        /**
         * If we still have no top candidate, just use the body as a last resort.
         * We also have to copy the body node so it is something we can modify.
         **/
        if (topCandidate === null || topCandidate.tagName === "BODY")
        {
            topCandidate = document.createElement("DIV");
            topCandidate.innerHTML = page.innerHTML;
            page.innerHTML = "";
            page.appendChild(topCandidate);
            readability.initializeNode(topCandidate);
        }
}, 'grabArticle find top candidate');

        /**
         * Now that we have the top candidate, look through its siblings for content that might also be related.
         * Things like preambles, content split by ads that we removed, etc.
        **/
        var articleContent        = document.createElement("DIV");

timed(function(){
        if (isPaging) {
            articleContent.id     = "s-article-content";
        }
        var siblingScoreThreshold = Math.max(10, topCandidate.readability.contentScore * 0.2);
        var siblingNodes          = topCandidate.parentNode.childNodes;


        for(var s=0, sl=siblingNodes.length; s < sl; s+=1) {
            var siblingNode = siblingNodes[s];
            var append      = false;

            /**
             * Fix for odd IE7 Crash where siblingNode does not exist even though this should be a live nodeList.
             * Example of error visible here: http://www.esquire.com/features/honesty0707
            **/
            if(!siblingNode) {
                continue;
            }

            dbg("Looking at sibling node: " + siblingNode + " (" + siblingNode.className + ":" + siblingNode.id + ")" + ((typeof siblingNode.readability !== 'undefined') ? (" with score " + siblingNode.readability.contentScore) : ''));
            dbg("Sibling has score " + (siblingNode.readability ? siblingNode.readability.contentScore : 'Unknown'));

            if(siblingNode === topCandidate)
            {
                append = true;
            }

            var contentBonus = 0;
            /* Give a bonus if sibling nodes and top candidates have the example same classname */
            if(siblingNode.className === topCandidate.className && topCandidate.className !== "") {
                contentBonus += topCandidate.readability.contentScore * 0.2;
            }

            if(typeof siblingNode.readability !== 'undefined' && (siblingNode.readability.contentScore+contentBonus) >= siblingScoreThreshold)
            {
                append = true;
            }
            
            if(siblingNode.nodeName === "P") {
                var linkDensity = readability.getLinkDensity(siblingNode);
                var nodeContent = readability.getInnerText(siblingNode);
                var nodeLength  = nodeContent.length;
                
                if(nodeLength > 80 && linkDensity < 0.25)
                {
                    append = true;
                }
                else if(nodeLength < 80 && linkDensity === 0 && nodeContent.search(/\.( |$)/) !== -1)
                {
                    append = true;
                }
            }

            if(append) {
                dbg("Appending node: " + siblingNode);

                var nodeToAppend = null;
                if(siblingNode.nodeName !== "DIV" && siblingNode.nodeName !== "P") {
                    /* We have a node that isn't a common block level element, like a form or td tag. Turn it into a div so it doesn't get filtered out later by accident. */
                    
                    dbg("Altering siblingNode of " + siblingNode.nodeName + ' to div.');
                    nodeToAppend = document.createElement("DIV");
                    try {
                        nodeToAppend.id = siblingNode.id;
                        nodeToAppend.innerHTML = siblingNode.innerHTML;
                    }
                    catch(er) {
                        dbg("Could not alter siblingNode to div, probably an IE restriction, reverting back to original.");
                        nodeToAppend = siblingNode;
                        s-=1;
                        sl-=1;
                    }
                } else {
                    nodeToAppend = siblingNode;
                    s-=1;
                    sl-=1;
                }
                
                /* To ensure a node does not interfere with readability styles, remove its classnames */
                nodeToAppend.className = "";

                /* Append sibling and subtract from our list because it removes the node when you append to another node */
                articleContent.appendChild(nodeToAppend);
                siblingNodes.length; //arrix
            }
        }
}, 'grabArticle look through its siblings');

        /**
         * So we have all of the content that we need. Now we clean it up for presentation.
        **/
        readability.prepArticle(articleContent);

        articleContent.innerHTML = '<div id="s-article-page-iframely" class="page">' + articleContent.innerHTML + '</div>';

        /**
         * Now that we've gone through the full algorithm, check to see if we got any meaningful content.
         * If we didn't, we may need to re-run grabArticle with different flags set. This gives us a higher
         * likelihood of finding the content, and the sieve approach gives us a higher likelihood of
         * finding the -right- content.
        **/
        if(readability.getInnerText(articleContent, false).length < 200) {
        page.innerHTML = pageCacheHtml;

            if (readability.flagIsActive(readability.FLAG_STRIP_UNLIKELYS)) {
                readability.removeFlag(readability.FLAG_STRIP_UNLIKELYS);
                return readability.grabArticle(page);
            }
            else if (readability.flagIsActive(readability.FLAG_WEIGHT_CLASSES)) {
                readability.removeFlag(readability.FLAG_WEIGHT_CLASSES);
                return readability.grabArticle(page);
            }
            else if (readability.flagIsActive(readability.FLAG_CLEAN_CONDITIONALLY)) {
                readability.removeFlag(readability.FLAG_CLEAN_CONDITIONALLY);
                return readability.grabArticle(page);
            } else {
                return null;
            }
        }
        
        return articleContent;
    },
    
    /**
     * Removes script tags from the document.
     *
     * @param Element
    **/
    removeScripts: function (doc) {
        var scripts = doc.getElementsByTagName('script');
        for(var i = scripts.length-1; i >= 0; i-=1)
        {
            if(typeof(scripts[i].src) === "undefined" || (scripts[i].src.indexOf('readability') === -1 && scripts[i].src.indexOf('typekit') === -1))
            {
                scripts[i].nodeValue="";
                scripts[i].removeAttribute('src');
                if (scripts[i].parentNode) {
                        scripts[i].parentNode.removeChild(scripts[i]);          
                }
            }
        }
    },
    
    /**
     * Get the inner text of a node - cross browser compatibly.
     * This also strips out any excess whitespace to be found.
     *
     * @param Element
     * @return string
    **/
    getInnerText: function (e, normalizeSpaces) {
        var textContent    = "";

        if(typeof(e.textContent) === "undefined" && typeof(e.innerText) === "undefined") {
            return "";
        }

        normalizeSpaces = (typeof normalizeSpaces === 'undefined') ? true : normalizeSpaces;

        if (navigator.appName === "Microsoft Internet Explorer") {
            textContent = e.innerText.replace( readability.regexps.trim, "" ); }
        else {
            textContent = e.textContent.replace( readability.regexps.trim, "" ); }

        if(normalizeSpaces) {
            return textContent.replace( readability.regexps.normalize, " "); }
        else {
            return textContent; }
    },

    /**
     * Get the number of times a string s appears in the node e.
     *
     * @param Element
     * @param string - what to split on. Default is ","
     * @return number (integer)
    **/
    getCharCount: function (e,s) {
        s = s || ",";
        return readability.getInnerText(e).split(s).length-1;
    },

    /**
     * Remove the style attribute on every e and under.
     * TODO: Test if getElementsByTagName(*) is faster.
     *
     * @param Element
     * @return void
    **/
    cleanStyles: function (e) {
        e = e || document;
        var cur = e.firstChild;

        if(!e) {
            return; }

        // Remove any root styles, if we're able.
        if(typeof e.removeAttribute === 'function' && e.className !== 'readability-styled') {
            e.removeAttribute('style'); }

        // Go until there are no more child nodes
        while ( cur !== null ) {
            if ( cur.nodeType === 1 ) {
                // Remove style attribute(s) :
                if(cur.className !== "readability-styled") {
                    cur.removeAttribute("style");                   
                }
                readability.cleanStyles( cur );
            }
            cur = cur.nextSibling;
        }           
    },
    
    /**
     * Get the density of links as a percentage of the content
     * This is the amount of text that is inside a link divided by the total text in the node.
     * 
     * @param Element
     * @return number (float)
    **/
    getLinkDensity: function (e) {
        var links      = e.getElementsByTagName("a");
        var textLength = readability.getInnerText(e).length;
        var linkLength = 0;
        for(var i=0, il=links.length; i<il;i+=1)
        {
            linkLength += readability.getInnerText(links[i]).length;
        }       

        return linkLength / textLength;
    },
    
    /**
     * Find a cleaned up version of the current URL, to use for comparing links for possible next-pageyness.
     *
     * @author Dan Lacy
     * @return string the base url
    **/
    findBaseUrl: function () {
        var noUrlParams     = window.location.pathname.split("?")[0],
            urlSlashes      = noUrlParams.split("/").reverse(),
            cleanedSegments = [],
            possibleType    = "";

        for (var i = 0, slashLen = urlSlashes.length; i < slashLen; i+=1) {
            var segment = urlSlashes[i];

            // Split off and save anything that looks like a file type.
            if (segment.indexOf(".") !== -1) {
                possibleType = segment.split(".")[1];

                /* If the type isn't alpha-only, it's probably not actually a file extension. */
                if(!possibleType.match(/[^a-zA-Z]/)) {
                    segment = segment.split(".")[0];                    
                }
            }
            
            /**
             * EW-CMS specific segment replacement. Ugly.
             * Example: http://www.ew.com/ew/article/0,,20313460_20369436,00.html
            **/
            if(segment.indexOf(',00') !== -1) {
                segment = segment.replace(',00', '');
            }

            // If our first or second segment has anything looking like a page number, remove it.
            if (segment.match(/((_|-)?p[a-z]*|(_|-))[0-9]{1,2}$/i) && ((i === 1) || (i === 0))) {
                segment = segment.replace(/((_|-)?p[a-z]*|(_|-))[0-9]{1,2}$/i, "");
            }


            var del = false;

            /* If this is purely a number, and it's the first or second segment, it's probably a page number. Remove it. */
            if (i < 2 && segment.match(/^\d{1,2}$/)) {
                del = true;
            }
            
            /* If this is the first segment and it's just "index", remove it. */
            if(i === 0 && segment.toLowerCase() === "index") {
                del = true;
            }

            /* If our first or second segment is smaller than 3 characters, and the first segment was purely alphas, remove it. */
            if(i < 2 && segment.length < 3 && !urlSlashes[0].match(/[a-z]/i)) {
                del = true;
            }

            /* If it's not marked for deletion, push it to cleanedSegments. */
            if (!del) {
                cleanedSegments.push(segment);
            }
        }

        // This is our final, cleaned, base article URL.
        return window.location.protocol + "//" + window.location.host + cleanedSegments.reverse().join("/");
    },

    /**
     * Build a simple cross browser compatible XHR.
     *
     * TODO: This could likely be simplified beyond what we have here right now. There's still a bit of excess junk.
    **/
    xhr: function () {
        /*if (typeof XMLHttpRequest !== 'undefined' && (window.location.protocol !== 'file:' || !window.ActiveXObject)) {
            return new XMLHttpRequest();
        }
        else {
            try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(sixerr) { }
            try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(threrr) { }
            try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(err) { }
        }*/
        var request = require('request');

        return request;
    },

    successfulRequest: function (request) {
        return (request.status >= 200 && request.status < 300) || request.status === 304 || (request.status === 0 && request.responseText);
    },

    ajax: function (url, callback) {
        var request = readability.xhr();
        request({url:url, 'encoding':'binary'}, callback);

        return request;
    },

    /**
     * Get an elements class/id weight. Uses regular expressions to tell if this 
     * element looks good or bad.
     *
     * @param Element
     * @return number (Integer)
    **/
    getClassWeight: function (e) {
        if(!readability.flagIsActive(readability.FLAG_WEIGHT_CLASSES)) {
            return 0;
        }

        var weight = 0;

        /* Look for a special classname */
        if (typeof(e.className) === 'string' && e.className !== '')
        {
            if(e.className.search(readability.regexps.negative) !== -1) {
                weight -= 25; }

            if(e.className.search(readability.regexps.positive) !== -1) {
                weight += 25; }
        }

        /* Look for a special ID */
        if (typeof(e.id) === 'string' && e.id !== '')
        {
            if(e.id.search(readability.regexps.negative) !== -1) {
                weight -= 25; }

            if(e.id.search(readability.regexps.positive) !== -1) {
                weight += 25; }
        }

        return weight;
    },

    /*
     * Checks if @text contains one of valid embed URi patterns
     */
    containsAllowedEmbedURI: function(text){
        return readability.embedAllowedRegexps.some(function(regex){
            return regex.test(text);
        })
    },

    /**
     * Remove extraneous break tags from a node.
     *
     * @param Element
     * @return void
     **/
    killBreaks: function (e) {
        try {
            e.innerHTML = e.innerHTML.replace(readability.regexps.killBreaks,'<br />');       
        }
        catch (eBreaks) {
            dbg("KillBreaks failed - this is an IE bug. Ignoring.: " + eBreaks);
        }
    },

    /**
     * Clean a node of all elements of type "tag".
     * (Unless it's a youtube/vimeo video. People love movies.)
     *
     * @param Element
     * @param string tag to clean
     * @return void
     **/
    clean: function (e, tag) {
        var targetList = e.getElementsByTagName( tag );
        var isEmbed = (tag === 'embed' || tag ==='iframe');
        var isEmbedComplex = (tag === 'object');

        for (var y=targetList.length-1; y >= 0; y-=1) {
            if (isEmbed) {
                var src = targetList[y].getAttribute('src');
                if (src && readability.containsAllowedEmbedURI(src)){
                    continue;
                }
            } else if (isEmbedComplex) {
                var attributeValues = "";
                for (var i=0, il=targetList[y].attributes.length; i < il; i+=1) {
                    attributeValues += targetList[y].attributes[i].value + '|';
                }
                /*Check attributes for valid URIs*/
                if (readability.containsAllowedEmbedURI(attributeValues)){
                    continue;
                }

                /* Then check the elements inside this element for the same. */
                if (readability.containsAllowedEmbedURI(targetList[y].innerHTML)) {
                    continue;
                }
                
            }

            targetList[y].parentNode.removeChild(targetList[y]);
        }
    },

    /**
     * Clean an element of all tags of type "tag" if they look fishy.
     * "Fishy" is an algorithm based on content length, classnames, link density, number of images & embeds, etc.
     *
     * @return void
     **/
    cleanConditionally: function (e, tag) {

        if(!readability.flagIsActive(readability.FLAG_CLEAN_CONDITIONALLY)) {
            return;
        }

        var tagsList      = e.getElementsByTagName(tag);
        var curTagsLength = tagsList.length;

        /**
         * Gather counts for other typical elements embedded within.
         * Traverse backwards so we can remove nodes at the same time without effecting the traversal.
         *
         * TODO: Consider taking into account original contentScore here.
        **/
        for (var i=curTagsLength-1; i >= 0; i-=1) {
            var weight = readability.getClassWeight(tagsList[i]);
            var contentScore = (typeof tagsList[i].readability !== 'undefined') ? tagsList[i].readability.contentScore : 0;
            
            dbg("Cleaning Conditionally " + tagsList[i] + " (" + tagsList[i].className + ":" + tagsList[i].id + ")" + ((typeof tagsList[i].readability !== 'undefined') ? (" with score " + tagsList[i].readability.contentScore) : ''));

            if(weight+contentScore < 0)
            {
                tagsList[i].parentNode.removeChild(tagsList[i]);
            }
            else if ( readability.getCharCount(tagsList[i], readability.reComma) < 10) { //arrix
                /**
                 * If there are not very many commas, and the number of
                 * non-paragraph elements is more than paragraphs or other ominous signs, remove the element.
                **/
                var p      = tagsList[i].getElementsByTagName("p").length;
                var img    = tagsList[i].getElementsByTagName("img").length;
                var li     = tagsList[i].getElementsByTagName("li").length-100;
                var input  = tagsList[i].getElementsByTagName("input").length;

                //By now we should have cleaned up meaningless embeds
                var embeds = tagsList[i].getElementsByTagName("video").length+tagsList[i].getElementsByTagName("audio").length+tagsList[i].getElementsByTagName("iframe").length + tagsList[i].getElementsByTagName("embed").length + tagsList[i].getElementsByTagName("object").length;

                var linkDensity   = readability.getLinkDensity(tagsList[i]);
                var contentLength = readability.getInnerText(tagsList[i]).length;
                var toRemove      = false;

                if ( img > 1 && img > p ) {
                    toRemove = true;
                } else if(li > p && tag !== "ul" && tag !== "ol") {
                    toRemove = true;
                } else if( input > Math.floor(p/3) ) {
                    toRemove = true; 
                } else if(contentLength < 25 && embeds > 0) {
                    toRemove = false;
                } else if(contentLength < 25 && (img === 0 || img > 2) ) {
                    toRemove = true;
                } else if(weight < 25 && linkDensity > 0.2) {
                    toRemove = true;
                } else if(weight >= 25 && linkDensity > 0.5) {
                    toRemove = true;
                }

                if(toRemove) {
                    tagsList[i].parentNode.removeChild(tagsList[i]);
                }
            }
        }
    },

    /**
     * Clean out spurious headers from an Element. Checks things like classnames and link density.
     *
     * @param Element
     * @return void
    **/
    cleanHeaders: function (e) {
        for (var headerIndex = 1; headerIndex < 3; headerIndex+=1) {
            var headers = e.getElementsByTagName('h' + headerIndex);
            for (var i=headers.length-1; i >=0; i-=1) {
                if (readability.getClassWeight(headers[i]) < 0 || readability.getLinkDensity(headers[i]) > 0.33) {
                    headers[i].parentNode.removeChild(headers[i]);
                }
            }
        }
    },

    /**
     * Convert all relative URLs to absolute in attributes named @_attr of all @tag tags within an @e element 
     *
     * @return void
     **/
    fixURIs: function(e, tag, _attr){
        var tagsList = e.getElementsByTagName(tag);

        for (var i=0; i < tagsList.length; i++) {
            elURI = tagsList[i].getAttribute(_attr);
            if (elURI){
                tagsList[i].setAttribute(_attr,urllib.resolve(window.location.href, elURI));               
            }
        }
    },


    /**
     * Close the email popup. This is a hacktackular way to check if we're in a "close loop".
     * Since we don't have crossdomain access to the frame, we can only know when it has
     * loaded again. If it's loaded over 3 times, we know to close the frame.
     *
     * @return void
     **/
    removeFrame: function () {
        readability.iframeLoads+=1;
        if (readability.iframeLoads > 3)
        {
            var emailContainer = document.getElementById('email-container');
            if (null !== emailContainer) {
                emailContainer.parentNode.removeChild(emailContainer);
            }

            readability.iframeLoads = 0;
        }           
    },
    
    htmlspecialchars: function (s) {
        if (typeof(s) === "string") {
            s = s.replace(/&/g, "&amp;");
            s = s.replace(/"/g, "&quot;");
            s = s.replace(/'/g, "&#039;");
            s = s.replace(/</g, "&lt;");
            s = s.replace(/>/g, "&gt;");
        }
    
        return s;
    },

    flagIsActive: function(flag) {
        return (readability.flags & flag) > 0;
    },
    
    addFlag: function(flag) {
        readability.flags = readability.flags | flag;
    },
    
    removeFlag: function(flag) {
        readability.flags = readability.flags & ~flag;
    }
    
};

// func should return a node. The returned node will become the current node.
// return null means the node is removed.
// if returnedNode.oneMoreTime == true, it will be walked over again.
var LiveTagWalker = function(root, tag, func) {
	tag = tag.toUpperCase();
	var anyTag = tag == '*';

	function walk(cur) {
		var returnedNode, nextNode;
		while (cur) {
			nextNode = cur.nextSibling; //save a reference to the nextSibling. after a node is removed, node.nextSibling will be null
			if (cur.nodeType == 1) {
				if (anyTag || cur.tagName == tag) {
					returnedNode = func(cur);
					assert.ok(returnedNode !== undefined, 'must return either a Node or null');
					if (returnedNode) {
						cur = returnedNode;
						nextNode = cur.nextSibling
						if (cur.oneMoreTime) {
							// the node is replaced and the replacement node should be walked again
							delete cur.oneMoreTime;
							continue;
						} else {
							walk(cur.firstChild);
						}
					} else {
						//the node is removed
					}
				} else {
					walk(cur.firstChild);
				}
			}
			cur = nextNode;
		} // while

	}
	walk(root.firstChild);
};

//==============================================================================
var Utils = {
	extend: function(/* dst, src1, src2, ... */) {
		var args = [].slice.call(arguments);
		var dst = args.shift();

		for (var i = 0, l = args.length, src; src = args[i], i < l; i++) {
			for (var k in src) {
				dst[k] = src[k];
			}
		}
		return dst;
	}
};
var jsdom = require('jsdom'),
	assert = require('assert'),
	mod_sprintf = require('./sprintf'),
	sprintf = mod_sprintf.sprintf;


(function() {
	var R = readability;
	var patch = {
		reComma: /[\uff0c,]/, // chinese comma, too
		getArticleTitle: (function() {
			var old = R.getArticleTitle;
			return function() {
				var elm = old.call(R);
				elm.id = "s-article-title";
				return elm;
			};
		})(),

		// hundredfold faster
		// use native string.trim
		// jsdom's implementation of textContent is innerHTML + strip tags + HTMLDecode
		// here we replace it with an optimized tree walker
		getInnerText: function (e, normalizeSpaces) {
			if (normalizeSpaces === undefined) normalizeSpaces = true;

			function TextWalker(node, func) {
				function walk(cur) {
					var children, len, i;
					if (cur.nodeType == 3) {
						func(cur);
						return;
					} else if (cur.nodeType != 1) {
						return;
					}

					children = cur.childNodes;
					for (i = 0, len = children.length; i < len; i++) {
						walk(children[i]);
					}
				}
				walk(node);
			}

			var textContent = '';
			TextWalker(e, function(cur) {
				textContent += cur.nodeValue;
			});
			textContent = textContent.trim();
			//var textContent = e.textContent.trim();

			if(normalizeSpaces) {
				return textContent.replace( readability.regexps.normalize, " "); }
			else {
				return textContent;
			}
		},

		cleanStyles: function (e) {
			e = e || document;

			function walk(cur) {
				var children, i, l;

				if (cur.nodeType == 1) {
					if (cur.className != 'readability-styled') {
						cur.removeAttribute("style");
					}

					children = cur.childNodes;
					for (i = 0, l = children.length; i < l; i++) {
						walk(children[i]);
					}
				}
			}
			walk(e);
		},

		//// new methods ///
		reset: function() {
			var z = this;
			z.iframeLoads = 0;
			z.bodyCache = true; //bodyCache seems to be unused. make it true to avoid creation
			z.flags = 0x1 | 0x2 | 0x4;
			z.parsedPages = {};
			z.pageETags = {};
		},

		getDefaultArticleContent: function() {
			var articleContent	  = document.createElement("DIV");
			articleContent.id = "s-article-content";
			articleContent.innerHTML =
			'<p>Sorry, unable to parse article content. Please view the original page instead.</p>';
			return articleContent;
		}
	};

	for (var k in patch) R[k] = patch[k];
})();

var MyProfiler = {
	stats: {},
	timed_level: 0,
	enabled: false,
	timed: function(func, name, options) {
		if (!MyProfiler.enabled) return func();
		options = options || {};
		var z = this;
		//dbg('begin ' + name);
		z.timed_level++;
		name = name || func.name;
		if (!z.stats[name]) z.stats[name] = 0;
		var st = z.stats[name] || (z.stats[name] = {count: 0, time: 0});
		var time = new Date().getTime();
		var ret = func();
		var ellapsed = new Date().getTime() - time;
		st.time += ellapsed;
		st.count++;
		if (!options.silent)
			dbg(new Array(z.timed_level).join('  ') + ellapsed / 1000 + ' seconds [' + name + '] ' + (options.moreInfo || ''));
		z.timed_level--;
		return ret;
	},

	timerize: function(name, funcName, obj, options) {
		var f = obj[funcName];
		obj[funcName] = function() {
			var z = this;
			var args = [].slice.call(arguments);
			return timed(function() { return f.apply(z, args)}, name, options);
		}
	},

	report: function() {
		dbg('Profiling summary ==========================');
		var stats = this.stats;
		for (var name in stats) {
			var st = stats[name];
			dbg(sprintf("%5d\t%7.3f\t%s", st.count, st.time / 1000, name));
		};
	},

	reset: function() {
		this.stats = {};
		this.timed_level = 0;
	}
};

function timed() {
	return MyProfiler.timed.apply(MyProfiler, arguments);
}

(function() {
	MyProfiler.timerize('================= TOTAL', 'init', readability);
	//return;
	MyProfiler.timerize('prepDocument', 'prepDocument', readability);
	MyProfiler.timerize('prepArticle', 'prepArticle', readability);
	MyProfiler.timerize('grabArticle', 'grabArticle', readability);

	//608	  2.431 most time taken by getInnerText
	MyProfiler.timerize('getLinkDensity', 'getLinkDensity', readability, {silent: true});
	MyProfiler.timerize('getInnerText', 'getInnerText', readability, {silent: true});
	MyProfiler.timerize('cleanConditionally', 'cleanConditionally', readability);
	//MyProfiler.timerize('clean', 'clean', readability);
	//MyProfiler.timerize('killBreaks', 'killBreaks', readability);
	//MyProfiler.timerize('cleanStyles', 'cleanStyles', readability, {silent: true});
	//MyProfiler.timerize('cleanHeaders', 'cleanHeaders', readability);

	// 627 0.013
	//MyProfiler.timerize('getClassWeight', 'getClassWeight', readability, {silent: true});

	//MyProfiler.timerize('getElementsByTagName', 'getElementsByTagName', jsdom.defaultLevel.Element.prototype, {silent: true});
	//MyProfiler.timerize('update', 'update', jsdom.defaultLevel.NodeList.prototype, {silent: true});
	//MyProfiler.timerize('removeAttribute', 'removeAttribute', jsdom.defaultLevel.Element.prototype, {silent: true});

})();

function removeReadabilityArtifacts() {
	var titleContainer = document.getElementById('s-article-title');
	if (null !== titleContainer) {
		document.title = titleContainer.innerHTML;
	}
	
	var contentContainer = document.getElementById('s-article-page-iframely');
	if (null !== contentContainer) {
		document.body.innerHTML = contentContainer.innerHTML;
	}
}

function removeClassNames(e) {
	var e = e || document;
	var cur = e.firstChild;

	if(!e) {
		return; }

	// Remove any root class names, if we're able.
	if(e.className) {
		e.className = "";
	}

	// Go until there are no more child nodes
	while ( cur !== null ) {
		if ( cur.nodeType === 1 ) {
			// Remove class names
			if(e.className) {
				e.className = "";
			}
			removeClassNames(cur);
		}
		cur = cur.nextSibling;
	}           
}

function straightifyDocument(doc){
    var tagsParagraphBreaking = /^(?:p|img|ul|ol|blockquote|pre|cite|iframe|h\d)$/i;
    var tagsDoNotTouch = /^(?:object|video|audio)$/i;
    var tagsParagraphNonBreaking = /^(?:a|b|i|em|strong|li|br|code)$/i
    var tagsBanned = /^(?:div)$/i

    var straightDocument = document.createElement("DIV");
    var nodeStack = [];

    function addSibling(el){
        if (!nodeStack.length){
            nodeStack.unshift(document.createElement("P"));
        }
        nodeStack[0].appendChild(el);
    }

    function addTextElement(el){
        if (!nodeStack.length){
            nodeStack.unshift(document.createElement("P"));
        }
        nodeStack[0].appendChild(el.cloneNode(true));
    }

    function openLevel(el, chk, clone){
        nodeStack.unshift(el.cloneNode(!!clone));
        if (chk) nodeStack[0].chk = chk;
    }

    function checkLevel(chk){
        return (nodeStack[0] && (nodeStack[0].chk == chk));
    }

    function closeLevel(){
        var current = nodeStack.shift();
        if (current && current.childNodes.length && nodeStack.length){
            addSibling(current);
        }
        return current;
    }

    function closeAll(){
        var fullNode, curLevel;
        while (curLevel=closeLevel()){
            fullNode = curLevel;
        }
        if (fullNode && !(/^\s+$/).test(fullNode.innerHTML)){
            straightDocument.appendChild(fullNode);
        }
    }

    function parseLevel(e, lvl){
        if (!e) return;
        var cur = e.firstChild;

        while ( cur !== null ) {
            //console.log(lvl, cur.nodeType, cur.toString(), cur.childNodes.length);
            if (cur.nodeType == document.ELEMENT_NODE){
                if (tagsBanned.test(cur.tagName)){
                    closeAll();
                    parseLevel(cur, lvl+1);
                    closeAll();
                } else if (tagsDoNotTouch.test(cur.tagName)){
                    closeAll();
                    openLevel(cur, null, true);
                    closeAll();
                } else if (tagsParagraphBreaking.test(cur.tagName)){
                    closeAll();
                    openLevel(cur);
                    parseLevel(cur, lvl+1);
                    closeAll();
                } else if (tagsParagraphNonBreaking.test(cur.tagName)){
                    var rnd = Math.round(Math.random()*100000000000)
                    openLevel(cur, rnd);
                    parseLevel(cur,lvl+1);
                    if (checkLevel(rnd)) closeLevel();
                } else {
                    parseLevel(cur,lvl+1);
                }
            } else if (cur.nodeType == document.TEXT_NODE){
                addTextElement(cur);
            }
            cur = cur.nextSibling;
        }

    }

    parseLevel(doc,0);
    closeAll();

    return straightDocument;
}

function start(w, options, cb) {
	window = w;
	document = w.document;

	readConvertLinksToFootnotes=false; readStyle='style-novel'; readSize='size-medium'; readMargin='margin-wide';

	navigator = w.navigator;
	location = w.location;

	readability.reset();
	readability.debugging = options.debug;
	
	MyProfiler.enabled = options.profile;
	if (options.profile) {
		MyProfiler.reset();
	}
    readability.success = cb;

    if (options.onParseError){
        readability.stopOnNoContent = true;
        readability.failure = options.onParseError;
    }

    readability.returnContentOnly = !!options.returnContentOnly;
    readability.removeClassNames = !!options.removeClassNames;
    readability.straightifyDocument = !!options.straightifyDocument;

    if (options.videoRegexpOverride) readability.regexps.videos = options.videoRegexpOverride;

	readability.init();

	if (options.profile) MyProfiler.report();

	if (options.removeReadabilityArtifacts) removeReadabilityArtifacts();
	if (options.removeClassNames) removeClassNames();
    document.body.innerHTML = '<div id="s-article-content">' + document.body.innerHTML + '</div>';
	//dbg('[Readability] done');
	//cb(document.body.innerHTML);
}

var HTML5;
try {
	HTML5 = require('html5');
} catch(e) {}

exports.parse = function parse(theHtml, url, options, callback) {
	// backward compatibility: readability.parse(html, url, callback)
	if (typeof options == 'function') {
		callback = options;
		options = {};
	}
	var defaultOptions = {
		profile: false,
		debug: false,
		removeReadabilityArtifacts: true,
		removeClassNames: true,
        onParseError: false,
        videoRegexpOverride: false,
	};
	options = Utils.extend({}, defaultOptions, options);
   if(options.encoding && !{'utf8':1}[options.encoding.toLowerCase()]) {
        body = new Buffer(theHtml, 'binary');
        iconv = new Iconv(options.encoding, 'utf8');
        theHtml = iconv.convert(body).toString('utf8');
    }
	var startTime = new Date().getTime();
	//dbg(html);
	var html = theHtml.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
	var html = theHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
	// Turn all double br's into p's. Advanced from prepDocument to here
	// saves > 1 seconds for large pages.
	html = html.replace(readability.regexps.replaceBrs, '</p><p>').replace(readability.regexps.replaceFonts, '<$1span>');
	try {
		var docOptions = {
			url: url,
			// do not fetch or process any external resources
			features : {
				FetchExternalResources	 : [],
				ProcessExternalResources : false
			},
		};

		function createDocWithHTMLParser() {
			var doc = jsdom.jsdom(html, null, docOptions);
			return doc;
		}

		function createDocWithHTML5() {
			var browser = jsdom.browserAugmentation(jsdom.defaultLevel, docOptions);
			var doc = new browser.HTMLDocument();
			var parser = new HTML5.Parser({document: doc});
			parser.parse(html);
			return doc;
		}

		var doc = createDocWithHTMLParser();

		if (!doc.body) {
			dbg('empty body');

			// HTMLParser is not forgiving enough for pages without closing head tag
			// https://github.com/tautologistics/node-htmlparser/issues#issue/12
			// Use HTML5 parser to fix
			if (HTML5) {
				dbg('retrying with HTML5.Parser');
				doc = createDocWithHTML5();
				if (doc.body) {
					// recreate the doc with HTMLParser because HTML5 throws exception when running readability
					html = doc.innerHTML;
					doc = createDocWithHTMLParser();
				}
			}
		}

		if (!doc.body) {
			dbg('doc.body is still null.');
			return callback({title: '', content: '', error: true});
		}

		//dbg('---DOM created');

		var win = doc.parentWindow;
		win = win || doc.createWindow(); //for backward compatibility with jsdom <= 0.1.20

		start(win, options, function(html) {
			//dbg(html);
			var time = new Date().getTime() - startTime;
			callback({title: document.title, content: html, time: time / 1000, inputLength: theHtml.length});
		});
	} catch(e) {
		//throw e;
		dbg('Error', e.message, e.stack);
		callback({title: '', content: '', error: true});
	}
};

//jsdom tweaks
if (!jsdom.applyDocumentFeatures)
(function() {
	//hack for older versions of jsdom when features can't be disabled by API
	var core = jsdom.defaultLevel;
	//disable loading frames
	delete core.HTMLFrameElement.prototype.setAttribute;

	//disable script evaluation
	delete core.HTMLScriptElement.prototype.init;
})();

exports.sprintf = sprintf;
