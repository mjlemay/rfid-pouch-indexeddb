import { configure } from '@testing-library/dom';

// PouchDB builds its find index on first use, which can take over a second
// when the whole suite runs in parallel. Give async queries room for that.
configure({ asyncUtilTimeout: 4000 });
