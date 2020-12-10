import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { getImageSizeFitWidth, getImageSizeFitWidthFromCache, NOOP, DEFAULT_HEIGHT } from './utils';
import {View, Image} from 'react-native'

function ImageAutoSize(props) {
  const {
    onHeightChange,
    source,
    width,
    style,
    maxHeight,
    onError,
    ...rest
  } = props;
  const [height, setHeight] = useState(
    getImageSizeFitWidthFromCache(source, width, maxHeight).height ||
      DEFAULT_HEIGHT
  );
  const mountedRef = useRef(false);

  useEffect(function () {
    mountedRef.current = true;
    return function () {
      mountedRef.current = false;
    };
  }, []);

  useEffect(
    function () {
      (async function () {
        try {
          const { height: newHeight } = await getImageSizeFitWidth(
            source,
            width,
            maxHeight
          );
          if (mountedRef.current) {
            setHeight(newHeight);
            onHeightChange(newHeight);
          }
        } catch (e) {
          onError(e);
        }
      })();
    },
    [source, onHeightChange, width, maxHeight]
  );

  const imageStyles = { height };
  return (
    <View style={{width, height, justifyContent:'center', alignItems:'center'}}>
    <Image
          source={source}
          style={[imageStyles, style]}
          {...rest}
        />
    </View>
    
  );
}

ImageAutoSize.propTypes = {
  ...ImagePropTypes,
  width: PropTypes.number.isRequired,
  maxHeight: PropTypes.number,
  onHeightChange: PropTypes.func,
  animated: PropTypes.bool
};

ImageAutoSize.defaultProps = {
  maxHeight: Infinity,
  onHeightChange: NOOP,
  animated: false
};

export default ImageAutoSize;
