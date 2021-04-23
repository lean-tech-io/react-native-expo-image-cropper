import React, { Component, PureComponent } from "react";
import { Platform } from "react-native";
import {
  NativeModules,
  PanResponder,
  Dimensions,
  Image,
  View,
  Animated,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

class ImageCropper extends Component {
  constructor(props) {
    super(props);

    const { initialHeight, initialWidth, initialCrop } = props;

    this.coors = {
      topLeft: new Animated.ValueXY({ x: 0, y: 0 }),
      bottomLeft: new Animated.ValueXY({ x: 0, y: initialHeight }),
      topRight: new Animated.ValueXY({ x: initialWidth, y: 0 }),
      bottomRight: new Animated.ValueXY({ x: initialWidth, y: initialHeight }),
    };

    if (initialCrop) {
      this.coors = {
        topLeft: new Animated.ValueXY(initialCrop.topLeft),
        bottomLeft: new Animated.ValueXY(initialCrop.bottomLeft),
        topRight: new Animated.ValueXY(initialCrop.topRight),
        bottomRight: new Animated.ValueXY(initialCrop.bottomRight),
      };
    }

    this.gestures = {
      topLeft: this.createPanResponser(this.coors.topLeft),
      bottomLeft: this.createPanResponser(this.coors.bottomLeft),
      topRight: this.createPanResponser(this.coors.topRight),
      bottomRight: this.createPanResponser(this.coors.bottomRight),
    };

    this.translate = {
      topLeft: [{ translateX: -15 }, { translateY: -15 }],
      bottomLeft: [{ translateX: -15 }, { translateY: -30 }],
      topRight: [{ translateX: -30 }, { translateY: -15 }],
      bottomRight: [{ translateX: -30 }, { translateY: -30 }],
    };

    this.state = {
      overlayPositions: this.getNewOverlayString(),
    };
  }

  getNewOverlayString = () => {
    const { topLeft, bottomLeft, topRight, bottomRight } = this.coors;
    let topLeftx = topLeft.x._value + topLeft.x._offset;
    let topLefty = topLeft.y._value + topLeft.y._offset;

    let topRightx = topRight.x._value + topRight.x._offset;
    let topRighty = topRight.y._value + topRight.y._offset;

    let bottomRightx = bottomRight.x._value + bottomRight.x._offset;
    let bottomRighty = bottomRight.y._value + bottomRight.y._offset;

    let bottomLeftx = bottomLeft.x._value + bottomLeft.x._offset;
    let bottomLefty = bottomLeft.y._value + bottomLeft.y._offset;
    return `${topLeftx},${topLefty} ${topRightx},${topRighty} ${bottomRightx},${bottomRighty} ${bottomLeftx},${bottomLefty}`;
  };

  updateOverlayString = () =>
    this.setState({ overlayPositions: this.getNewOverlayString() });

  createPanResponser = (corner) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: (e, gestureState) => true,
      onPanResponderMove: (e, gestureState) => {
        const { initialHeight, initialWidth } = this.props;
        if (corner.y._value + gestureState.dy < 0) {
          gestureState.dy = -corner.y._value;
        }
        if (corner.x._value + gestureState.dx < 0) {
          gestureState.dx = -corner.x._value;
        }
        if (corner.x._value + gestureState.dx > initialWidth) {
          gestureState.dx = initialWidth - corner.x._value;
        }
        if (corner.y._value + gestureState.dy > initialHeight) {
          gestureState.dy = initialHeight - corner.y._value;
        }

        corner.setOffset({
          x: gestureState.dx,
          y: gestureState.dy,
        });

        this.updateOverlayString();
      },
      onPanResponderRelease: () => {
        corner.flattenOffset();
        this.updateOverlayString();
        const { onLayoutChanged } = this.props;
        if (onLayoutChanged) {
          const currentCoors = Object.keys(this.coors)
            .map((key) => ({
              [key]: {
                y: this.coors[key].y._value,
                x: this.coors[key].x._value,
              },
            }))
            .reduce((a, c) => ({ ...a, ...c }), []);
          onLayoutChanged(currentCoors);
        }
      },
    });
  };

  render() {
    const {
      initialHeight,
      initialWidth,
      initialLeft,
      initialTop,
      strokeWidth = 3,
    } = this.props;
    const { overlayPositions } = this.state;

    const points = Object.keys(this.coors).map((key) => ({
      panHandlers: this.gestures[key].panHandlers,
      p: this.coors[key],
      translate: this.translate[key],
      key,
    }));

    return (
      <View
        style={{
          position: "absolute",
          height: initialHeight,
          width: initialWidth,
          left: initialLeft,
          top: initialTop,
        }}
      >
        <Svg height={initialHeight} width={initialWidth}>
          <AnimatedPolygon
            fill="#000"
            fillOpacity={0.5}
            stroke="#a4a4a4"
            points={overlayPositions}
            strokeWidth={strokeWidth}
          />
        </Svg>
        {points.map((point) => (
          <Animated.View
            key={point.key}
            {...point.panHandlers}
            style={[
              point.p.getLayout(),
              {
                width: 45,
                aspectRatio: 1,
                transform: point.translate,
                position: "absolute",
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <View
              style={{
                width: "60%",
                aspectRatio: 1,
                borderRadius: 25,
                backgroundColor: "red",
              }}
            />
          </Animated.View>
        ))}
      </View>
    );
  }
}

export default ImageCropper;
