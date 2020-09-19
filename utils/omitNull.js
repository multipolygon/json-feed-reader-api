import _ from 'lodash';

export default (obj) =>
    _.omitBy(
        obj,
        (i) =>
            _.isNaN(i) ||
            i === undefined ||
            i === null ||
            i === '' ||
            (_.isArray(i) && i.length === 0),
    );
