﻿import mediaService from './mediaService';
import listItemService from './listItemService';
import Component from './component';
import debounceService from './debounceService';

class RightMenuComponent extends Component {
    rightMenuElement: HTMLElement = document.getElementById('right-menu');
    wrapperElement: HTMLElement;
    editArticleElement: HTMLElement;
    articleElement: HTMLElement;
    mainContainer: HTMLElement;
    articleHeadingElements: NodeList;
    outlineElement: HTMLElement;
    metadataElement: HTMLElement;
    outlineWrapperElement: HTMLElement;
    outlineTitleElement: HTMLElement;
    outlineAnchors: NodeList;
    indicatorElement: HTMLElement;
    outlineIndicatorSpanElement: HTMLElement;
    outlineLastAnchorElement: HTMLElement;
    outlineRootUlElement: HTMLElement;
    footerElement: HTMLElement;

    outlineAnchorDataWithoutScroll: { [index: number]: OutlineAnchorData };
    outlineAnchorDataWithScroll: { [index: number]: OutlineAnchorData };
    outlineHeightWithoutScroll: number;
    outlineHeightWithoutScrollPX: string;
    outlineHeightWithScrollPX: string;
    topHeight: number;
    fixedTopBottom: number;

    // Arbitrary gaps
    topMenuGap: number = 16;
    bottomMenuGap: number = 23;

    updateHistoryTimeout: number;

    protected validDomElementExists(): boolean {
        return this.rightMenuElement ? true : false;
    }

    protected setup(): void {
        this.wrapperElement = this.rightMenuElement.querySelector('.wrapper') as HTMLElement;
        this.editArticleElement = document.getElementById('edit-article');
        this.articleElement = document.querySelector('main > article') as HTMLElement;
        this.mainContainer = document.querySelector('body > .container') as HTMLElement;
        this.articleHeadingElements = this.articleElement.querySelectorAll('h2,h3');
        this.outlineWrapperElement = document.querySelector('#right-menu > .wrapper > .wrapper') as HTMLElement;
        this.outlineElement = document.getElementById('outline') as HTMLElement;
        this.indicatorElement = document.getElementById('outline-indicator') as HTMLElement;
        this.outlineIndicatorSpanElement = this.indicatorElement.querySelector('span') as HTMLElement;
        this.footerElement = document.getElementsByTagName('footer')[0];

        this.setupOutline();
        this.outlineTitleElement = document.querySelector('#right-menu > .wrapper > .wrapper > span') as HTMLElement;
        this.outlineRootUlElement = this.outlineElement.querySelector('ul');
        let outlineAnchorElements = this.outlineElement.querySelectorAll('a');
        this.outlineLastAnchorElement = outlineAnchorElements[outlineAnchorElements.length - 1];

        // Initial call
        this.updateRightMenu();
    }

    protected registerListeners(): void {
        window.addEventListener('scroll', this.onScrollListener);
        window.addEventListener('resize', this.onResizeListener);
    }

    private onResizeListener = (): void => {
        if (this.mainContainer.style.display !== 'none') {
            this.updateRightMenu();
        }
    }

    public onScrollListener = (): void => {
        if (this.mainContainer.style.display !== 'none') {
            let activeHeadingIndex = this.getActiveOutlineIndex();

            // Debounce history update to avoid flashing in url bar and perf overhead
            window.clearTimeout(this.updateHistoryTimeout);
            this.updateHistoryTimeout = window.setTimeout(this.updateHistory, 200, activeHeadingIndex);

            if (mediaService.mediaWidthWide()) {
                this.updateOutline(activeHeadingIndex);
            }
        }
    }

    public updateRightMenu(): void {
        if (!this.validDomElementExists()) {
            return;
        }

        this.setRightMenuDomLocation();

        let activeHeadingIndex = this.getActiveOutlineIndex();
        // Must be called after dom location is set
        this.updateOutline(activeHeadingIndex);
    }

    private updateHistory = (activeHeadingIndex: number): void => {
        let activeHeadingElement = this.articleHeadingElements[activeHeadingIndex] as HTMLElement;
        history.replaceState(null, null, `#${activeHeadingElement.getAttribute('id')}`);
    }

    private updateOutline(activeHeadingIndex: number): void {
        let fixed = this.wrapperElement.classList.contains('fixed');

        if (mediaService.mediaWidthWide()) {
            if (!this.outlineHeightWithoutScroll) {
                // The first time media width is wide, initialize outline constants. At this point outline has no fixed height, so its height is accurate.
                // Cache tops and heights of outline anchors relative to outline
                this.topHeight = this.outlineTitleElement.getBoundingClientRect().bottom - this.rightMenuElement.getBoundingClientRect().top;
                this.fixedTopBottom = this.topMenuGap + this.topHeight;

                let indicatorBoundingRect = this.indicatorElement.getBoundingClientRect();
                // TODO does font affect height? Is height dependent solely on font-size?
                // Get height of outline without scrollbar
                this.outlineHeightWithoutScroll = indicatorBoundingRect.height;
                this.outlineHeightWithoutScrollPX = `${this.outlineHeightWithoutScroll}px`;
                this.outlineAnchorDataWithoutScroll = this.createAnchorTopsAndHeightsCache();
            }

            let top = this.wrapperElement.parentElement.getBoundingClientRect().top;
            let fix = top < this.topMenuGap;

            // To prevent layouts, do all reads before writes
            let outlineHeight: number = this.getOutlineHeight(fix);
            let outlineScrollable = this.outlineHeightWithoutScroll > outlineHeight;

            this.setOutlineHeight(outlineHeight, outlineScrollable);

            if (outlineScrollable && !this.outlineAnchorDataWithScroll) {
                // The first time outline is scrollable, after setting height, initialize constants.
                this.outlineAnchorDataWithScroll = this.createAnchorTopsAndHeightsCache();

                // Set outline indicator height
                // TODO The outline's ul element and indicator element are siblings with a parent that has display flex row.
                // The ul element's height is set to the cross axis height of it's parent - https://bugs.chromium.org/p/chromium/issues/detail?id=134729, 
                // this is what the spec dictates. A work around is to use height: max-content, but it is not supported on edge.
                this.outlineHeightWithScrollPX = `${this.outlineLastAnchorElement.getBoundingClientRect().bottom - this.indicatorElement.getBoundingClientRect().top}px`;
            }

            let activeOutlineAnchorData: OutlineAnchorData = this.getActiveOutlineAnchorData(activeHeadingIndex, outlineScrollable);
            this.updateOutlineIndicator(activeOutlineAnchorData, outlineScrollable);

            if (fix && !fixed) {
                // See leftMenuComponent.updateLeftMenu
                this.rightMenuElement.style.minHeight = `${this.rightMenuElement.clientHeight + 1}px`;
                this.wrapperElement.classList.add('fixed');
            } else if (!fix && fixed) {
                this.wrapperElement.classList.remove('fixed');
                this.rightMenuElement.style.minHeight = 'initial';
            }
        } else {
            this.outlineElement.style.height = 'auto';
            this.indicatorElement.style.height = 'auto';

            if (fixed) {
                this.wrapperElement.classList.remove('fixed');
                this.rightMenuElement.style.minHeight = 'initial';
            }
        }

    }

    private setRightMenuDomLocation(): void {
        let wide = mediaService.mediaWidthWide();
        let outlineInArticle = this.articleElement.querySelector('#outline') ? true : false;
        let editArticleInMetadata = this.articleElement.querySelector('#edit-article') ? true : false;

        if (!wide) {
            // Don't bother moving if outline is empty, moving messes up styles for surrounding elements
            if (this.outlineElement && !outlineInArticle) {
                $('main > article > .meta').after(this.rightMenuElement);
            }

            if (this.editArticleElement && !editArticleInMetadata) {
                document.getElementById('metadata-edit-article').appendChild(this.editArticleElement);
            }
        } else if (wide) {
            if (this.outlineElement && outlineInArticle) {
                $('body > .container').append(this.rightMenuElement);
            }

            if (this.editArticleElement && editArticleInMetadata) {
                $('#right-menu > .wrapper').prepend(this.editArticleElement);
            }
        }
    }

    private setupOutline(): void {
        let headingElements = document.querySelectorAll('main > article > h1,h2,h3');

        // Only h1
        if (headingElements.length === 1) {
            return;
        }

        let titleElement = document.querySelector('main > article > h1');
        let outlineTitle = titleElement ? titleElement.textContent : 'Outline';
        let spanElement = document.createElement('span');

        spanElement.innerHTML = outlineTitle;
        this.outlineWrapperElement.insertBefore(spanElement, this.outlineWrapperElement.children[0]);

        let listItemTree: ListItem = listItemService.generateListItemTree(headingElements,
            ['h2', 'h3'],
            document.createElement('a'),
            0);
        let ulElement = listItemService.generateMultiLevelList(listItemTree.items, '', 1);

        this.outlineElement.appendChild(ulElement);
        this.outlineAnchors = this.outlineElement.querySelectorAll('a');
    }

    private getActiveOutlineIndex(): number {
        let activeAnchorIndex: number;
        let minDistance = -1;

        // Search could be made more efficient, but would be a micro optimization
        for (let i = 0; i < this.articleHeadingElements.length; i++) {
            let headingElement = this.articleHeadingElements[i] as HTMLHeadingElement;
            // Can't be cached since article may have elements that expand/collapse
            let elementDistanceFromTop = Math.abs(headingElement.getBoundingClientRect().top);

            if (minDistance === -1 || elementDistanceFromTop < minDistance) {
                minDistance = elementDistanceFromTop;
                activeAnchorIndex = i;
            } else {
                break;
            }
        }

        return activeAnchorIndex;
    }

    private getActiveOutlineAnchorData(activeAnchorIndex: number, outlineScrollable: boolean): OutlineAnchorData {
        return outlineScrollable ? this.outlineAnchorDataWithScroll[activeAnchorIndex] :
            this.outlineAnchorDataWithoutScroll[activeAnchorIndex];
    }

    private updateOutlineIndicator(activeOutlineAnchorData: OutlineAnchorData, outlineScrollable: boolean): void {
        if (!outlineScrollable) {
            this.indicatorElement.style.height = this.outlineHeightWithoutScrollPX;
        } else {
            this.indicatorElement.style.height = this.outlineHeightWithScrollPX;
        }

        // Even if active anchor has not changed, must rewrite since scrollbar may have appeared
        let style = this.outlineIndicatorSpanElement.style;
        style.marginTop = activeOutlineAnchorData.topPX;
        style.height = activeOutlineAnchorData.heightPX;
    }

    private getOutlineHeight(fixed: boolean): number {
        let footerTop = this.footerElement.getBoundingClientRect().top;

        let outlineHeight = (footerTop > window.innerHeight ? window.innerHeight : footerTop)
            - this.bottomMenuGap
            - (fixed ? this.fixedTopBottom : this.rightMenuElement.getBoundingClientRect().top + this.topHeight);

        return outlineHeight;
    }

    private setOutlineHeight(outlineHeight: number, outlineScrollable: boolean): void {
        // Tried setting bottom, max-height, both don't work on edge - scroll bar doesn't go away even when height is greater than 
        // menu height. This works.
        this.outlineElement.style.height = `${outlineHeight}px`;

        if (outlineScrollable) {
            this.outlineRootUlElement.style.marginRight = '12px';
        } else {
            this.outlineRootUlElement.style.marginRight = '0';
        }
    }

    private createAnchorTopsAndHeightsCache(): { [index: number]: OutlineAnchorData } {
        let outlineIndicatorBoundingRect = this.indicatorElement.getBoundingClientRect();
        let result: { [index: number]: OutlineAnchorData } = {};

        for (let i = 0; i < this.outlineAnchors.length; i++) {
            let outlineAnchor = this.outlineAnchors[i] as HTMLElement;
            let anchorBoundingRect = outlineAnchor.getBoundingClientRect();

            result[i] = {
                topPX: `${anchorBoundingRect.top - outlineIndicatorBoundingRect.top}px`,
                heightPX: `${anchorBoundingRect.height}px`
            };
        }

        return result;
    }
}

interface OutlineAnchorData {
    topPX: string;
    heightPX: string;
}

export default new RightMenuComponent();