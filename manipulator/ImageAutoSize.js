import React, { PureComponent } from "react";
import { StyleSheet } from "react-native";
import PropTypes from "prop-types";

import {
  getImageSizeFitWidth,
  getImageSizeFitWidthFromCache,
  NOOP,
  DEFAULT_HEIGHT,
} from "./utils";
import { View, Image } from "react-native";

export default class AutoHeightImage extends PureComponent {
  static propTypes = {
    width: PropTypes.number.isRequired,
    onHeightChange: PropTypes.func,
  };

  static defaultProps = {
    onHeightChange: NOOP,
  };

  constructor(props) {
    super(props);
    this.setInitialImageHeight();
  }

  updateSequence = 0;

  async componentDidMount() {
    this.hasMounted = true;
    await this.updateImageHeight(this.props);
  }

  async componentDidUpdate(prevProps) {
    await this.updateImageHeight(prevProps);
  }

  componentWillUnmount() {
    this.hasMounted = false;
    // clear memory usage
    this.updateSequence = null;
  }

  setInitialImageHeight() {
    const { source, width, onHeightChange } = this.props;
    const { height = DEFAULT_HEIGHT } = getImageSizeFitWidthFromCache(
      source,
      width
    );
    this.state = { height };
    this.styles = StyleSheet.create({ image: { width, height } });
    onHeightChange(height);
  }

  async updateImageHeight(props) {
    if (
      this.state.height === DEFAULT_HEIGHT ||
      this.props.width !== props.width ||
      this.props.source !== props.source ||
      this.props.source.uri !== props.source.uri
    ) {
      // image height could not be `0`
      const { source, width, height: maxHeight, onHeightChange } = this.props;
      try {
        const updateSequence = ++this.updateSequence;
        const { height } = await getImageSizeFitWidth(source, width, maxHeight);
        if (updateSequence !== this.updateSequence) {
          return;
        }
        this.styles = StyleSheet.create({ image: { width, height } });
        if (this.hasMounted) {
          // guard `this.setState` to be valid
          this.setState({ height });
          onHeightChange(height);
        }
      } catch (ex) {
        if (this.props.onError) {
          this.props.onError(ex);
        }
      }
    }
  }

  render() {
    // remove `width` prop from `restProps`
    const { source, style, width, ...restProps } = this.props;
    return (
      <View
        style={{
          height: restProps.height,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          source={source}
          style={[this.styles.image, style]}
          {...restProps}
        />
      </View>
    );
  }
}
