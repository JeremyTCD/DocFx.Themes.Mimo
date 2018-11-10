import { injectable } from 'inversify';
import SearchResultsComponent from '../pageHeader/searchResultsComponent';
import SearchWorker = require('worker-loader?inline=true&fallback=false!../workers/search.worker');

@injectable()
export default class SearchService {
    private _searchResultsComponent: SearchResultsComponent;

    private _queryString: string;

    public constructor(searchResultsComponent: SearchResultsComponent) {
        this._searchResultsComponent = searchResultsComponent;
    }

    public setupSearch(): void {
        let searchWorker = new SearchWorker() as Worker;

        this.setupWebWorkerSearch(searchWorker);
    };

    private setupWebWorkerSearch(searchWorker: Worker): void {
        console.log("using Web Worker");

        // Get index.json url
        let linkElement = document.querySelector('head > link[href*="/index."]');
        let indexRelPath = linkElement.getAttribute('href');

        // Get search data
        let searchDataRequest = new XMLHttpRequest();
        searchDataRequest.open('GET', indexRelPath);
        searchDataRequest.onload = () => {
            // If no index.json is found, just leave the index empty
            if (searchDataRequest.status === 200) {
                // TODO move json parsing to worker
                searchWorker.postMessage({ eventType: 'search-data-received', payload: searchDataRequest.responseText });

                // TODO allow query string to perform search on page load
                let searchInputElement = document.getElementById('search-query');

                searchInputElement.
                    addEventListener('keypress', (event: KeyboardEvent) => {
                        // By default, browsers attempt to submit form if enter is pressed
                        if (event.key === 'Enter') {
                            event.preventDefault();
                        }
                    });

                searchInputElement.
                    addEventListener('keyup', (event: KeyboardEvent) => {
                        this._queryString = (event.currentTarget as HTMLInputElement).value;
                        if (this._queryString.length < 1) {
                            this._searchResultsComponent.setShown(false);
                        } else {
                            // By the time we add this event listener to the search input element,
                            // the search worker is already ready to receive messages.
                            searchWorker.postMessage({ eventType: 'query', payload: this._queryString });
                        }
                    });
            }
        }
        searchDataRequest.send();

        // Setup listener for query results
        searchWorker.onmessage = (event: MessageEvent) => {
            let snippets = event.data.payload;
            this._searchResultsComponent.setSnippets(snippets, this._queryString);
        }
    }
}
