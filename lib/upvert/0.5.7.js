'use strict';

var _ = require('lodash');
var current_version = require('../version');
var transform_utils = require('../transform_utils');

var version_incrementer = transform_utils.version_incrementer;
var top_level_types = transform_utils.top_level_types;
var recursion_keys = transform_utils.recursion_keys;
var accumulatorFor = transform_utils.accumulatorFor;

// Tags in 0.5.7 were mostly undefined object. In 0.5.8 they have specified properties. Fields which
// match the new properties should be preserved, those that do not should be moved into additional_properties.
var convertTag = function convertTag(old_tag) {

  var additional_properties = _.has(old_tag, 'additional_properties') && _.isObject(old_tag.additional_properties) ?
      _.cloneDeep(old_tag.additional_properties) : {};

  var tag = _.transform(old_tag, function(result, value, key, object) {
    // Specced Tag fields for 0.5.8
    if (_.includes(['_id', 'text', 'description', 'slug'], key)) {
      result[key] = value;
    }
    else {
      // Example: .foo should become .additional_properties.foo
      // In the unlikely even that .additional_properties.foo already existed on the old object,
      // then this will overwrite it (but it will show up as .additional_properties.additional_properties.foo)
      additional_properties[key] = value;
      // 'tag' was in use in some places in lieu of text, so copy over if possible
      if (key === 'tag' && !_.has(object, 'text')) {
        result['text'] = value;
      }
    }
  }, {});

  if (_.size(additional_properties) > 0) {
    tag.additional_properties = additional_properties;
  }

  return tag;
};

// Convert a top-level ANS document and recur at known points
var convertDocument = function convertDocument(doc) {
  return _.transform(doc, function(result, value, key, object) {
    if (key === 'taxonomy') {
      var taxonomy = {};
      _.assign(taxonomy, value, { 'tags': _.map(value.tags, convertTag) });
      result[key] = taxonomy;
    }
    else if (_.includes(recursion_keys, key)) {
      result[key] = convert(value);
    }
  }, doc);
};

// Generic recur-and-convert down object tree
var convert = function convert(ans) {
  if (!_.isObject(ans)) {
    return ans;
  }

  if (_.isArray(ans)) {
    return _.map(ans, convert);
  }

  if (_.has(ans, 'type') &&
      _.includes(top_level_types, ans.type)) {
    return convertDocument(ans);
  }

  return _.transform(ans, function(result, value, key, object) {
    if (key === 'additional_properties' || key === 'referent_properties') {
      result[key] = value;
    }
    else {
      result[key] = convert(value);
    }
  }, accumulatorFor(ans));
};


var upvert = function(input) {
  var output = version_incrementer('0.5.8')(input);

  return convertDocument(output);
};

module.exports = upvert;