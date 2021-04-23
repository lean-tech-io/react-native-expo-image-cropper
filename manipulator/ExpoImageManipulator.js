import React, { Component } from "react";
import {
    Dimensions,
    Image,
    ScrollView,
    Modal,
    View,
    Text,
    SafeAreaView,
    TouchableOpacity,
    NativeModules,
    YellowBox,
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import PropTypes from "prop-types";
import ImageAutoSize from "./ImageAutoSize";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { isIphoneX } from "react-native-iphone-x-helper";
import ImageCropper from "../manipulator/ImageCropper";

const { width } = Dimensions.get("window");

YellowBox.ignoreWarnings([
    "componentWillReceiveProps",
    "componentWillUpdate",
    "componentWillMount",
]);
YellowBox.ignoreWarnings([
    "Warning: componentWillMount is deprecated",
    "Warning: componentWillReceiveProps is deprecated",
    "Module RCTImageLoader requires",
]);

class ExpoImageManipulator extends Component {
    constructor(props) {
        super(props);
        const { squareAspect } = this.props;
        this.state = {
            cropMode: false,
            processing: false,
            zoomScale: 1,
            squareAspect,
            crop: null,
        };

        this.scrollOffset = 0;

        this.maxSizes = {
            width: 0,
            height: 0,
        };

        this.initialSize = {
            width: 0,
            height: 0,
        };
    }

    async componentDidMount() {
        await this.onConvertImageToEditableSize();
    }

    async onConvertImageToEditableSize() {
        const {
            photo: { uri: rawUri },
            originalPhoto,
            originalCrop,
        } = this.props;
        let initialUri = originalPhoto?.uri;
        if (rawUri === this.lastUriProp) {
            return;
        }

        const { uri, width, height } = await ImageManipulator.manipulateAsync(
            rawUri,
            [
                {
                    resize: {
                        width: 1080,
                    },
                },
            ]
        );

        this.setState({
            uri,
            initialUri,
        });
        this.lastUriProp = rawUri;

        this.initialSize.width = width;
        this.initialSize.height = height;

        if (originalCrop) {
            this.cropCoors = {
                topLeft: originalCrop.topLeft,
                bottomLeft: originalCrop.bottomLeft,
                topRight: originalCrop.topRight,
                bottomRight: originalCrop.bottomRight,
            };
        }

        if (initialUri) {
            Image.getSize(initialUri, (w, h) => {
                this.initialSize.width = w;
                this.initialSize.height = h;
                if (!originalCrop) {
                    this.resetCropCoordinates();
                }
            });
        } else {
            const {
                uri: originalUri,
            } = await ImageManipulator.manipulateAsync(rawUri, [
                { resize: { width: 1080 } },
            ]);
            this.setState({ initialUri: originalUri });
            this.resetCropCoordinates();
        }
    }

    getCalculateCropSize(size) {
        const windowHeight = Dimensions.get("window").height;

        let imageRatio = size.height / size.width;
        let originalHeight = windowHeight - 64;

        if (isIphoneX()) {
            originalHeight = windowHeight - 122;
        }

        let cropRatio = originalHeight / width;

        let cropWidth =
            imageRatio < cropRatio ? width : originalHeight / imageRatio;
        let cropHeight =
            imageRatio < cropRatio ? width * imageRatio : originalHeight;

        let cropInitialTop = (originalHeight - cropHeight) / 2.0;
        let cropInitialLeft = (width - cropWidth) / 2.0;

        return {
            cropWidth,
            cropHeight,
            cropInitialTop,
            cropInitialLeft,
            imageRatio,
            originalHeight,
        };
    }

    resetCropCoordinates = () => {
        const { cropHeight, cropWidth } = this.getCalculateCropSize(
            this.initialSize
        );

        this.cropCoors = {
            topLeft: { x: 0, y: 0 },
            bottomLeft: { x: 0, y: cropHeight },
            topRight: { x: cropWidth, y: 0 },
            bottomRight: { x: cropWidth, y: cropHeight },
        };

        this.setState({ crop: this.cropCoors });
    };

    onNewManipulationHandler = async ({ action, payload }) => {
        const { initialUri } = this.state;

        const getUriManipulated = () => {
            switch (action) {
                case "flip":
                    return this.flip(initialUri, payload);
                case "rotate":
                    return this.rotate(initialUri, this.initialSize.width);
                default:
                    return Promise.resolve({ uri: initialUri });
            }
        };

        const { uri } = await getUriManipulated();
        this.setState({ initialUri: uri });
        this.props.onImageManipulated({ action, payload });
    };

    get isRemote() {
        const { uri } = this.state;
        return /^(http|https|ftp)?(?:[:/]*)([a-z0-9.-]*)(?::([0-9]+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/.test(
            uri
        );
    }

    onToggleModal = () => {
        const { onToggleModal } = this.props;
        onToggleModal();
        this.setState({ cropMode: false });
    };

    onCropImage = async () => {
        this.setState({ processing: true });
        const { initialUri, uri: oldUri } = this.state;
        const aspectRatio = width / this.initialSize.width;

        let coordinates = JSON.parse(JSON.stringify(this.cropCoors));

        if (aspectRatio < 1) {
            Object.keys(coordinates).forEach((key) => {
                const { x, y } = coordinates[key];
                coordinates[key].x = (x * 1) / aspectRatio;
                coordinates[key].y = (y * 1) / aspectRatio;
            });
        }

        coordinates = {
            ...coordinates,
            ...this.initialSize,
        };

        const { uri } = await this.crop(initialUri, coordinates);

        this.setState({ uri, base64: "", crop: this.cropCoors });
        this.setState({ cropMode: false, processing: false });
        FileSystem.deleteAsync(oldUri).catch(() => null);
        this.props.onImageManipulated({ action: "crop", payload: coordinates });
    };

    onRotateImage = async () => {
        const { uri } = this.state;
        let uriToCrop = uri;
        if (this.isRemote) {
            const response = await FileSystem.downloadAsync(
                uri,
                FileSystem.documentDirectory + "image"
            );
            uriToCrop = response.uri;
        }
        Image.getSize(uri, async (width2, height2) => {
            const { uri: rotUri, base64 } = await this.rotate(
                uriToCrop,
                width2,
                height2
            );
            this.setState({ uri: rotUri, base64 });
            const initialSizeHeight = this.initialSize.height;
            this.initialSize.height = this.initialSize.width;
            this.initialSize.width = initialSizeHeight;
            this.resetCropCoordinates();
            this.onNewManipulationHandler({ action: "rotate" });
        });
    };

    onFlipImage = async (orientation) => {
        const { uri: uriToCrop } = this.state;
        const { uri: rotUri, base64 } = await this.flip(uriToCrop, orientation);
        this.setState({ uri: rotUri, base64 });
        this.resetCropCoordinates();
        this.onNewManipulationHandler({ action: "flip", payload: orientation });
    };

    onHandleScroll = (event) => {
        this.scrollOffset = event.nativeEvent.contentOffset.y;
    };

    flip = async (uri, orientation) => {
        const { saveOptions } = this.props;
        const manipResult = await ImageManipulator.manipulateAsync(
            uri,
            [
                {
                    flip: orientation,
                },
            ],
            saveOptions
        );
        return manipResult;
    };

    rotate = async (uri, width2) => {
        const { saveOptions } = this.props;
        const manipResult = await ImageManipulator.manipulateAsync(
            uri,
            [
                {
                    rotate: -90,
                },
                {
                    resize: {
                        width: this.trueWidth || width2,
                        // height: this.trueHeight || height2,
                    },
                },
            ],
            saveOptions
        );
        this.setState(({ manipulation = {} }) => {
            const { rotate = 0, ...rest } = manipulation;
            if (rotate === -270) {
                return { manipulation: rest };
            }
            return {
                manipulation: {
                    ...rest,
                    rotate: rotate - 90,
                },
            };
        });
        return manipResult;
    };

    crop = (uri, coordinates) =>
        new Promise((resolve, reject) => {
            NativeModules.CustomCropManager.crop(
                coordinates,
                uri,
                async (err, res) => {
                    if (res?.image) {
                        const lastSlash = uri.lastIndexOf("/") + 1;
                        const newUri =
                            FileSystem.documentDirectory +
                            `${Date.now()}-` +
                            uri.substr(lastSlash);
                        await FileSystem.writeAsStringAsync(newUri, res.image, {
                            encoding: "base64",
                        });
                        resolve({ uri: newUri });
                    }
                    if (err) {
                        reject(err);
                    }
                }
            );
        });

    calculateMaxSizes = (event) => {
        let w1 = event.nativeEvent.layout.width || 100;
        let h1 = event.nativeEvent.layout.height || 100;
        if (this.state.squareAspect) {
            if (w1 < h1) h1 = w1;
            else w1 = h1;
        }
        this.maxSizes.width = w1;
        this.maxSizes.height = h1;
    };

    // eslint-disable-next-line camelcase
    async UNSAFE_componentWillReceiveProps() {
        // await this.onConvertImageToEditableSize();
    }

    zoomImage() {
        // this.refs.imageScrollView.zoomScale = 5
        // this.setState({width: width})
        // this.setState({zoomScale: 5})
        // this.setState(curHeight)
    }

    render() {
        const { isVisible, onPictureChoosed } = this.props;
        const { uri, initialUri, base64, cropMode, processing, crop } = this.state;

        const {
            cropHeight,
            cropWidth,
            cropInitialTop,
            cropInitialLeft,
            imageRatio,
            originalHeight,
        } = this.getCalculateCropSize(this.initialSize);

        if (uri == undefined) {
            return <View></View>;
        } else {
            return (
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={isVisible}
                    hardwareAccelerated
                    onRequestClose={() => {
                        this.onToggleModal();
                    }}
                >
                    <SafeAreaView
                        style={{
                            width,
                            flexDirection: "row",
                            backgroundColor: "black",
                            justifyContent: "space-between",
                        }}
                    >
                        <ScrollView
                            scrollEnabled={false}
                            horizontal
                            contentContainerStyle={{
                                width: "100%",
                                paddingHorizontal: 15,
                                height: 44,
                                alignItems: "center",
                            }}
                        >
                            {!cropMode ? (
                                <View style={{ flexDirection: "row" }}>
                                    <TouchableOpacity
                                        onPress={() => this.onToggleModal()}
                                        style={{
                                            width: 32,
                                            height: 32,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Icon size={24} name={"arrow-left"} color="white" />
                                    </TouchableOpacity>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: "row",
                                            justifyContent: "flex-end",
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => this.setState({ cropMode: true })}
                                            style={{
                                                marginLeft: 10,
                                                width: 32,
                                                height: 32,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Image
                                                source={require("../assets/crop-free.png")}
                                                style={{ width: 24, height: 24 }}
                                            ></Image>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => this.onRotateImage()}
                                            style={{
                                                marginLeft: 10,
                                                width: 32,
                                                height: 32,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Image
                                                source={require("../assets/rotate-left.png")}
                                                style={{ width: 24, height: 24 }}
                                            ></Image>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() =>
                                                this.onFlipImage(ImageManipulator.FlipType.Vertical)
                                            }
                                            style={{
                                                marginLeft: 10,
                                                width: 32,
                                                height: 32,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Image
                                                source={require("../assets/flip-vertical.png")}
                                                style={{ width: 24, height: 24 }}
                                            ></Image>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() =>
                                                this.onFlipImage(ImageManipulator.FlipType.Horizontal)
                                            }
                                            style={{
                                                marginLeft: 10,
                                                width: 32,
                                                height: 32,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Image
                                                source={require("../assets/flip-horizontal.png")}
                                                style={{ width: 24, height: 24 }}
                                            ></Image>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                onPictureChoosed({ uri, initialUri, base64, crop });
                                                this.onToggleModal();
                                            }}
                                            style={{
                                                marginLeft: 10,
                                                width: 60,
                                                height: 32,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontWeight: "500",
                                                    color: "white",
                                                    fontSize: 18,
                                                }}
                                            >
                                                {"DONE"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: "row" }}>
                                    <TouchableOpacity
                                        onPress={() => this.setState({ cropMode: false })}
                                        style={{
                                            width: 32,
                                            height: 32,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Icon size={24} name={"arrow-left"} color="white" />
                                    </TouchableOpacity>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: "row",
                                            justifyContent: "flex-end",
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => this.onCropImage()}
                                            style={{
                                                marginRight: 10,
                                                width: 60,
                                                height: 32,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontWeight: "500",
                                                    color: "white",
                                                    fontSize: 18,
                                                }}
                                            >
                                                {processing ? "Processing" : "CROP"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </SafeAreaView>
                    <View style={{ flex: 1, backgroundColor: "black", width }}>
                        <ScrollView
                            ref={"imageScrollView"}
                            style={{ position: "relative", flex: 1 }}
                            contentContainerStyle={{ backgroundColor: "black" }}
                            maximumZoomScale={5}
                            minimumZoomScale={0.5}
                            onScroll={this.onHandleScroll}
                            bounces={false}
                            showsHorizontalScrollIndicator={false}
                            showsVerticalScrollIndicator={false}
                            ref={(c) => {
                                this.scrollView = c;
                            }}
                            scrollEventThrottle={16}
                            scrollEnabled={false}
                            pinchGestureEnabled={false}
                        // scrollEnabled={cropMode ? false : true}
                        // pinchGestureEnabled={cropMode ? false : pinchGestureEnabled}
                        >
                            <ImageAutoSize
                                style={{ backgroundColor: "black" }}
                                source={{ uri: cropMode ? initialUri : uri }}
                                resizeMode={imageRatio >= 1 ? "contain" : "contain"}
                                width={width}
                                height={originalHeight}
                                onLayout={this.calculateMaxSizes}
                            />
                            {cropMode && (
                                <ImageCropper
                                    initialWidth={cropWidth}
                                    initialHeight={cropHeight}
                                    initialTop={cropInitialTop}
                                    initialLeft={cropInitialLeft}
                                    initialCrop={this.cropCoors}
                                    minHeight={100}
                                    minWidth={100}
                                    onLayoutChanged={(coors) => (this.cropCoors = coors)}
                                />
                            )}
                        </ScrollView>
                    </View>
                </Modal>
            );
        }
    }
}

export default ExpoImageManipulator;

ExpoImageManipulator.defaultProps = {
    onPictureChoosed: ({ uri, base64 }) => null,
    onImageManipulated: () => null,
    btnTexts: {
        crop: "Crop",
        rotate: "Rotate",
        done: "Done",
        processing: "Processing",
    },
    dragVelocity: 100,
    resizeVelocity: 50,
    saveOptions: {
        compress: 1,
        format: ImageManipulator.SaveFormat.PNG,
        base64: false,
    },
};

ExpoImageManipulator.propTypes = {
    isVisible: PropTypes.bool.isRequired,
    onPictureChoosed: PropTypes.func,
    btnTexts: PropTypes.object,
    saveOptions: PropTypes.object,
    photo: PropTypes.object.isRequired,
    onToggleModal: PropTypes.func.isRequired,
    dragVelocity: PropTypes.number,
    resizeVelocity: PropTypes.number,
    originalCrop: PropTypes.shape({
        topLeft: PropTypes.object,
        bottomLeft: PropTypes.object,
        topRight: PropTypes.object,
        bottomRight: PropTypes.object,
    }),
    onImageManipulated: PropTypes.func,
};
