import React, { useState } from "react";
import PropTypes from "prop-types";
import { Badge, Button, Card, Col, FloatingLabel, Form, Stack } from "react-bootstrap";
import { microAlgosToString, truncateAddress } from "../../utils/conversions";
import Identicon from "../utils/Identicon";

const Book = ({ address, book, buyBook, deleteBook, likeBook,
    dislikeBook, }) => {
    const { name, image, description, price, sold, likes, dislikes, appId, owner,} =
        book;

    const [count, setCount] = useState(1)

    return (
        <Col key={appId}>
            <Card className="h-100">
                <Card.Header>
                    <Stack direction="horizontal" gap={2}>
                        <span className="font-monospace text-secondary">{truncateAddress(owner)}</span>
                        <Identicon size={28} address={owner} />
                        <Badge bg="secondary" className="ms-auto">
                            {sold} Sold
                        </Badge>
                        <div><Badge bg="secondary" className="ms-auto">
                            {likes} Likes
                        </Badge>
                        <Badge bg="secondary" className="ms-auto">
                            {dislikes} Dislikes
                        </Badge></div>
                        
                    </Stack>
                </Card.Header>
                <div className="ratio ratio-4x3">
                    <img src={image} alt={name} style={{ objectFit: "cover" }} />
                </div>
                <Card.Body className="d-flex flex-column text-center">
                    <Card.Title>{name}</Card.Title>
                    <Card.Text className="flex-grow-1">{description}</Card.Text>
                    <Form className="d-flex align-content-stretch flex-row gap-2">
                        <FloatingLabel
                            controlId="inputCount"
                            label="Count"
                            className="w-25"
                        >
                            <Form.Control
                                type="number"
                                value={count}
                                min="1"
                                max="10"
                                onChange={(e) => {
                                    setCount(Number(e.target.value));
                                }}
                            />
                        </FloatingLabel>
                        <Button
                            variant="outline-dark"
                            onClick={() => buyBook(book, count)}
                            className="w-75 py-3"
                        >
                            Buy for {microAlgosToString(price) * count} ALGO
                        </Button>
                        <Button
                            variant="outline-dark"
                            onClick={() => likeBook(book)}
                            className="btn"
                        >
                            {book.like}
                            <i class="bi bi-emoji-smile"></i>
                        </Button>
                        <Button
                            variant="outline-dark"
                            onClick={() => dislikeBook(book)}
                            className="btn"
                        >
                            {book.dislike}
                            <i class="bi bi-emoji-frown-fill"></i>
                        </Button>
                        {book.owner === address &&
                            <Button
                                variant="outline-danger"
                                onClick={() => deleteBook(book)}
                                className="btn"
                            >
                                <i className="bi bi-trash"></i>
                            </Button>
                        }
                    </Form>
                </Card.Body>
            </Card>
        </Col>
    );
};

Book.propTypes = {
    address: PropTypes.string.isRequired,
    book: PropTypes.instanceOf(Object).isRequired,
    buyBook: PropTypes.func.isRequired,
    deleteBook: PropTypes.func.isRequired,
    likeBook: PropTypes.func.isRequired,
    dislikeBook: PropTypes.func.isRequired,
};

export default Book;
