var R = require('ramda');

var Events = {
    CREATE: 'annotationcreate',
    REMOVE: 'annotationremove',
    CHANGE: 'annotationchange'
};

function Annotations(annotationCtor, contextDocument) {
    this.annotationCtor = annotationCtor;
    this.contextDocument = contextDocument;
    this._cache = new ExpandoCache('AnnotatedNodes');
    this._addToNode = addToSet(this._cache);
    this._removeFromNode = removeFromSet(this._cache);
}

Annotations.prototype.create = function create() {
    var onchange = this._handleChange.bind(this);
    var a = new this.annotationCtor(onchange);

    dispatchEvent(this.contextDocument, Events.CREATE, {target: a});
    return a;
};

Annotations.prototype.get = function get(nodes) {
    var getAnnotations = R.pipe(
        R.map(this._cache.get.bind(this._cache)),
        R.filter(R.isArrayLike),
        R.flatten,
        R.uniq
    );

    return getAnnotations(nodes);
};

Annotations.prototype.remove = function remove(annotation) {
    var getNodes = R.pipe(
        R.prop('targets'),
        R.map(R.prop('nodes')),
        R.filter(R.isArrayLike),
        R.flatten
    );

    R.forEach(
        this._removeFromNode(annotation),
        getNodes(annotation)
    );

    dispatchEvent(this.contextDocument, Events.REMOVE, {target: annotation});
};

Annotations.prototype._handleChange = function _handleChange(record) {
    var getNodesFromTargets = R.pipe(
        R.map(R.prop('nodes')),
        R.filter(R.isArrayLike),
        R.flatten
    );

    if ('removedTargets' in record) {
        R.forEach(
            this._removeFromNode(record.target),
            getNodesFromTargets(record.removedTargets)
        );
    }

    if ('addedTargets' in record) {
        R.forEach(
            this._addToNode(record.target),
            getNodesFromTargets(record.addedTargets)
        );
    }

    dispatchEvent(this.contextDocument, Events.CHANGE, record);
};


function ExpandoCache(prefix) {
    this._expando = prefix + (-new Date());
    this._cache = {};
    this._id = 0;
}

ExpandoCache.prototype.set = function set(node, val) {
    var id = node[this._expando];
    if (typeof id === 'undefined') {
        id = this._id++;
    }
    node[this._expando] = id;

    this._cache[id] = val;
};

ExpandoCache.prototype.get = function get(node) {
    var id = node[this._expando];
    if (typeof id === 'undefined') {
        return;
    }

    return this._cache[id];
};

ExpandoCache.prototype.del = function del(node) {
    var id = node[this._expando];
    if (typeof id === 'undefined') {
        return;
    }

    delete this._cache[id];
};

function dispatchEvent(doc, type, detail) {
    if (!doc) {
        return;
    }

    var ev = doc.createEvent('CustomEvent');
    ev.initCustomEvent(type, false, false, detail);

    doc.dispatchEvent(ev);
}

var addToSet = R.curry(function (cache, obj, node) {
    var set = cache.get(node);
    if (typeof set === 'undefined') {
        set = [];
    }
    if (!R.contains(obj, set)) {
        cache.set(node, R.appendTo(set, obj));
    }
});

var removeFromSet = R.curry(function (cache, obj, node) {
    var set = cache.get(node);
    if (typeof set === 'undefined') {
        set = [];
    }
    cache.set(node, R.reject(R.eq(obj), set));
});

exports.Annotations = Annotations;
